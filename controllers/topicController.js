import supabaseService, { getTopicById } from '../services/supabaseService.js';
import aiService from '../services/aiService.js';
import supabase from '../config/supabase.js';
import pdfService from '../services/pdfService.js';
import { parseSummary } from '../utils/helpers.js';
import { extractYouTubeTranscript } from '../services/youtubeService.js';

// Create new topic and process it
export const createTopic = async (req, res) => {
  try {
    const {
      title,
      type,
      content,
      difficulty,
      includeFlashcards,
      includeQuiz,
      includeSummary,
      includeMindMap
    } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!title || !type || !content) {
      return res.status(400).json({
        error: 'Missing required fields: title, type, content'
      });
    }

    // Validate type
    const validTypes = ['text', 'youtube', 'pdf', 'audio', 'image'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // For MVP, only support text
    // if (type !== 'text') {
    //   return res.status(400).json({
    //     error: `Type "${type}" not supported yet. Currently only "text" is supported.`,
    //     supportedTypes: ['text'],
    //     comingSoon: ['youtube', 'pdf', 'audio', 'image']
    //   });
    // }

    // Validate text length (only for text input)
    if (type === 'text') {
      if (content.length < 50) {
        return res.status(400).json({
          error: 'Text content must be at least 50 characters'
        });
      }

      if (content.length > 10000) {
        return res.status(400).json({
          error: 'Content too long. Maximum 10,000 characters.'
        });
      }
    }

    // Check subscription limits
    const subscriptionInfo = await supabaseService.getUserSubscriptionInfo(userId);
    const { subscription_plan, topics_created_count } = subscriptionInfo;

    // Free plan: limit to 1 topic
    if (subscription_plan === 'free' && topics_created_count >= 1) {
      return res.status(403).json({
        error: 'Topic limit reached',
        message: 'You have reached the free plan limit of 1 topic. Please upgrade to create more topics.',
        subscription_plan,
        topics_created_count,
        limit: 1
      });
    }

    console.log(`📝 Creating topic for user ${userId}...`);

    // 1. Create topic in DB with processing status
    const topic = await supabaseService.createTopic({
      userId,
      title,
      type,
      status: 'processing',
      progress: 0,
      difficulty: difficulty || 'medium',
      createdAt: new Date().toISOString()
    });

    console.log(`✅ Topic created with ID: ${topic.id}`);

    // Increment topic creation counter
    try {
      await supabaseService.incrementTopicCount(userId);
      console.log(`📊 Topic counter incremented for user ${userId}`);
    } catch (counterError) {
      console.error('⚠️ Failed to increment topic counter:', counterError);
      // Don't fail the request if counter increment fails
    }

    // 2. Process content asynchronously (don't await)
    processContent(topic.id, content, type, difficulty || 'medium', userId, {
      includeFlashcards,
      includeQuiz,
      includeSummary,
      includeMindMap
    });

    // 3. Return immediately
    res.status(201).json({
      success: true,
      message: 'Topic created! Processing in background...',
      topic: {
        id: topic.id,
        title: topic.title,
        type: topic.type,
        status: 'processing',
        progress: 0
      }
    });

  } catch (error) {
    console.error('❌ Create topic error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get topic with processed content
export const getTopic = async (req, res) => {
  try {
    const { topicId } = req.params;
    const userId = req.user.id;

    const topic = await supabaseService.getTopicById(topicId);

    // Verify ownership
    if (topic.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Transform to match frontend expected shape
    const formattedTopic = {
      ...topic,
      generationProgress: typeof topic.progress === 'number' ? topic.progress : 0,
      progress: topic.studyProgress || {
        flashcardsReviewed: 0,
        quizScore: 0,
        lastScore: 0
      }
    };

    res.json({
      success: true,
      topic: formattedTopic
    });

  } catch (error) {
    console.error('❌ Get topic error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get user's all topics
export const getUserTopics = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const filter = req.query.filter || 'recent'; // recent, week, month

    console.log(`🔍 Controller received filter: "${filter}" for user ${userId}`);

    const topics = await supabaseService.getUserTopics(userId, limit, filter);

    const formattedTopics = topics.map(topic => ({
      ...topic,
      generationProgress: typeof topic.progress === 'number' ? topic.progress : 0,
      progress: topic.studyProgress || {
        flashcardsReviewed: 0,
        quizScore: 0,
        lastScore: 0
      }
    }));

    res.json({
      success: true,
      count: formattedTopics.length,
      topics: formattedTopics
    });

  } catch (error) {
    console.error('❌ Get user topics error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete topic
export const deleteTopic = async (req, res) => {
  try {
    const { topicId } = req.params;
    const userId = req.user.id;

    // Try to get the topic
    let topic;
    try {
      topic = await supabaseService.getTopicById(topicId);
    } catch (error) {
      // Topic doesn't exist
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Verify ownership
    if (topic.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Delete the topic
    await supabaseService.deleteTopic(topicId);

    res.json({
      success: true,
      message: 'Topic deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete topic error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Store device token for push notifications
export const storeDeviceToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    const userId = req.user.id;

    if (!token || !platform) {
      return res.status(400).json({
        error: 'Missing required fields: token, platform'
      });
    }

    await supabaseService.storeDeviceToken(userId, token, platform);

    res.json({
      success: true,
      message: 'Device token stored'
    });

  } catch (error) {
    console.error('❌ Store device token error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Remove device token
export const removeDeviceToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    await supabaseService.deleteDeviceToken(token);

    res.json({
      success: true,
      message: 'Device token removed'
    });

  } catch (error) {
    console.error('❌ Remove device token error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Background processing function
async function processContent(topicId, content, type, difficulty, userId, options = {}) {
  try {
    console.log(`🔄 Processing topic ${topicId}...`);

    // Update status to processing
    await supabaseService.updateTopicStatus(topicId, 'processing');
    await supabaseService.updateProgress(topicId, 10);

    // For text type, content is already text
    // For other types, we'll extract text first (Week 2-4)
    let text = content;

    if (type === 'youtube') {
      try {
        console.log(`🎥 Extracting transcript from YouTube URL: ${content}`);
        const transcriptData = await extractYouTubeTranscript(content);
        text = transcriptData.text;

        // Update topic title with video title
        if (transcriptData.title) {
          console.log(`📝 Updating topic title to: ${transcriptData.title}`);
          await supabaseService.updateTopicTitle(topicId, transcriptData.title);
        }

        console.log(`✅ Transcript extracted: ${text.length} chars`);
      } catch (error) {
        console.error('❌ YouTube extraction failed:', error);
        throw new Error('Failed to extract YouTube transcript. Video might be private or have no captions.');
      }
    }

    await supabaseService.updateProgress(topicId, 30);

    console.log(`📝 Text length: ${text.length} characters`);

    // Generate quiz, summary, flashcards with AI
    console.log(`🤖 Sending to AI...`);
    await supabaseService.updateProgress(topicId, 50);

    const processedContent = await aiService.generateContent(text, difficulty, options);

    // Update title with AI-generated title for text inputs (better than "Custom Text")
    if (type === 'text' && processedContent.title) {
      console.log(`📝 Updating topic title to AI title: ${processedContent.title}`);
      await supabaseService.updateTopicTitle(topicId, processedContent.title);
    }

    await supabaseService.updateProgress(topicId, 90);

    // Save to database
    console.log(`💾 Saving to database...`);
    await supabaseService.saveProcessedContent(topicId, processedContent);

    console.log(`✅ Topic ${topicId} processed successfully!`);

    // TODO: Send push notification (Week 2)
    // const tokens = await supabaseService.getUserDeviceTokens(userId);
    // await notificationService.sendTopicReady(tokens, topicId);

  } catch (error) {
    console.error(`❌ Process content error for topic ${topicId}:`, error);

    // Update topic with error
    await supabaseService.updateTopicStatus(topicId, 'failed', {
      error: error.message
    });
  }
}

// GET /api/topics/stats
export const getTopicStats = async (req, res) => {
  const userId = req.user.id;

  const { count: total } = await supabase
    .from('topics')
    .select('*', { count: 'exact', head: true })
    .eq('userId', userId);

  const { count: completed } = await supabase
    .from('topics')
    .select('*', { count: 'exact', head: true })
    .eq('userId', userId)
    .eq('status', 'completed');

  res.json({
    success: true,
    stats: { total, completed, processing: total - completed }
  });
};

// Download topic as PDF
export const downloadTopicPDF = async (req, res) => {
  try {
    const { topicId } = req.params;
    const userId = req.user.id;

    // Get topic
    const topic = await supabaseService.getTopicById(topicId);

    // Verify ownership
    if (topic.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check status
    if (topic.status !== 'completed') {
      return res.status(400).json({
        error: 'Topic is not completed yet',
        status: topic.status
      });
    }

    console.log(`📄 Generating PDF for topic ${topicId}...`);

    let html;
    const summaryData = topic.summary;

    // Check if summary is already HTML
    if (typeof summaryData === 'string' && summaryData.trim().startsWith('<!DOCTYPE')) {
      console.log('✅ Summary is already HTML');
      html = summaryData;
    }
    // Check if summary is HTML without DOCTYPE
    else if (typeof summaryData === 'string' && summaryData.trim().startsWith('<html')) {
      console.log('✅ Summary is HTML without DOCTYPE');
      html = summaryData;
    }
    // Try to parse as JSON
    else if (typeof summaryData === 'string') {
      try {
        const parsed = JSON.parse(summaryData);
        console.log('✅ Summary parsed from JSON, converting to HTML');
        html = pdfService.convertSummaryToHTML(parsed, topic.title, topic.difficulty);
      } catch (e) {
        console.error('⚠️ Failed to parse summary as JSON:', e.message);
        return res.status(500).json({
          error: 'Invalid summary format - not HTML or JSON'
        });
      }
    }
    // Already an object
    else if (typeof summaryData === 'object') {
      console.log('✅ Summary is object, converting to HTML');
      html = pdfService.convertSummaryToHTML(summaryData, topic.title, topic.difficulty);
    }
    else {
      return res.status(500).json({
        error: 'Unknown summary format'
      });
    }

    // Generate PDF
    const pdfBuffer = await pdfService.generatePDFFromHTML(html);

    // Set response headers
    const filename = `smart-notes-${topic.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

    console.log(`✅ PDF downloaded successfully!`);

  } catch (error) {
    console.error('❌ Download PDF error:', error);
    res.status(500).json({
      error: error.message || 'PDF generation failed'
    });
  }
};

// Get topic HTML (for preview)
export const getTopicHTML = async (req, res) => {
  try {
    const { topicId } = req.params;
    const userId = req.user.id;

    const topic = await supabaseService.getTopicById(topicId);

    if (topic.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (topic.status !== 'completed') {
      return res.status(400).json({
        error: 'Topic is not completed yet'
      });
    }

    let html;
    const summaryData = topic.summary;

    // Check if already HTML
    if (typeof summaryData === 'string' &&
      (summaryData.trim().startsWith('<!DOCTYPE') || summaryData.trim().startsWith('<html'))) {
      html = summaryData;
    }
    // Try to parse as JSON
    else if (typeof summaryData === 'string') {
      try {
        const parsed = JSON.parse(summaryData);
        html = pdfService.convertSummaryToHTML(parsed, topic.title, topic.difficulty);
      } catch (e) {
        return res.status(500).json({ error: 'Invalid summary format' });
      }
    }
    // Already an object
    else if (typeof summaryData === 'object') {
      html = pdfService.convertSummaryToHTML(summaryData, topic.title, topic.difficulty);
    }
    else {
      return res.status(500).json({ error: 'Unknown summary format' });
    }

    res.json({
      success: true,
      html: html,
      title: topic.title,
      difficulty: topic.difficulty
    });

  } catch (error) {
    console.error('❌ Get HTML error:', error);
    res.status(500).json({ error: error.message });
  }
};

