import { google } from 'googleapis';
import axios from 'axios';

export const extractYouTubeTranscript = async (url) => {
  const videoId = extractVideoId(url);
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY is not configured. Please add it to your environment variables.');
  }

  console.log(`🎥 Extracting transcript for video ID: ${videoId}`);
  console.log(`🔑 Using YouTube Data API v3`);

  const youtube = google.youtube({ version: 'v3', auth: apiKey });

  try {
    // Step 1: Get video details
    const videoResponse = await youtube.videos.list({
      part: ['snippet', 'contentDetails'],
      id: [videoId],
    });

    if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
      throw new Error('Video not found');
    }

    const video = videoResponse.data.items[0];
    const videoTitle = video.snippet.title;
    const duration = video.contentDetails.duration;

    console.log(`📺 Video: ${videoTitle}`);

    // Step 2: Get caption tracks
    const captionsResponse = await youtube.captions.list({
      part: ['snippet'],
      videoId: videoId,
    });

    const captions = captionsResponse.data.items;
    if (!captions || captions.length === 0) {
      throw new Error('This video has no captions available. Please try another video.');
    }

    // Prefer English, otherwise take first available
    const englishCaption = captions.find(c => c.snippet?.language === 'en');
    const caption = englishCaption || captions[0];
    const lang = caption.snippet?.language || 'en';

    console.log(`📝 Found caption track: ${caption.snippet?.name || lang}`);

    // Step 3: Use timedtext API (works for auto-generated captions without OAuth)
    const timedTextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`;

    console.log('🔄 Fetching transcript via timedtext API...');

    const response = await axios.get(timedTextUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
    });

    if (!response.data) {
      throw new Error('No transcript data received');
    }

    // Parse XML transcript
    let xmlData = response.data;
    if (typeof xmlData !== 'string') {
      xmlData = String(xmlData);
    }

    const matches = [...xmlData.matchAll(/<text[^>]*>(.*?)<\/text>/g)];

    if (matches.length === 0) {
      throw new Error('No text segments found in transcript');
    }

    const text = matches.map(m => {
      return m[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n/g, ' ');
    }).join(' ').trim();

    if (text.length === 0) {
      throw new Error('Transcript is empty');
    }

    console.log(`✅ Successfully extracted transcript (${text.length} characters)`);

    return {
      text,
      title: videoTitle,
      duration: duration,
      videoId,
    };

  } catch (error) {
    console.error('❌ Transcript extraction failed:', error.message);

    // Provide helpful error messages
    if (error.message.includes('API key')) {
      throw new Error('YouTube API key is invalid or missing. Please check your YOUTUBE_API_KEY environment variable.');
    }

    if (error.message.includes('quota')) {
      throw new Error('YouTube API quota exceeded. Please try again later or upgrade your API quota.');
    }

    if (error.message.includes('no captions')) {
      throw new Error('This video has no captions available. Please try another video with captions enabled.');
    }

    throw new Error(`Unable to extract transcript: ${error.message}`);
  }
};

// Helper to extract video ID from various YouTube URL formats
export const extractVideoId = (url) => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  throw new Error('Invalid YouTube URL');
};