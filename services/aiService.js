import OpenAI from 'openai';
import dotenv from 'dotenv';
import supabase from '../config/supabase.js';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Enhanced AI Content Generation
 * Production-grade prompt engineering for educational content
 */
/**
 * Enhanced AI Content Generation
 * Production-grade prompt engineering for educational content
 */

export const generateContent = async (text, difficulty = 'medium', options = {}) => {
  try {
    console.log('🤖 Generating content with AI...');
    console.log('   Options:', JSON.stringify(options));

    // Default to true if options not provided (backward compatibility)
    const {
      includeSummary = true,
      includeQuiz = true,
      includeFlashcards = true,
      includeMindMap = true,
      language = 'en'
    } = options;

    if (!text || text.trim().length < 50) {
      throw new Error('Text is too short. Please provide at least 50 characters.');
    }

    const difficultyInstructions = {
      easy: 'Use simple, clear language suitable for beginners.',
      medium: 'Balance between simple and technical language.',
      hard: 'Use technical language and advanced concepts.'
    };

    // Build prompt dynamically
    let promptInstructions = `
You are an expert educational content creator.

TEXT TO ANALYZE:
${text}

DIFFICULTY: ${difficulty.toUpperCase()}
${difficultyInstructions[difficulty]}

DIFFICULTY: ${difficulty.toUpperCase()}
${difficultyInstructions[difficulty]}

LANGUAGE: ${language === 'fr' ? 'French (Français)' : 'English'}
IMPORTANT: All generated content (titles, summaries, questions, flashcards, mind maps) MUST be in ${language === 'fr' ? 'French' : 'English'}. The JSON structure keys must remain in English, but the values/content must be in the target language.

Create a structured learning document with the following sections:
`;

    let sectionIndex = 1;
    const jsonStructure = { title: "Short Descriptive Title", icon: "LucideIconName" };

    promptInstructions += `
    1. TITLE: Generate a short, catchy, and descriptive title (max 5-7 words) that best summarizes the content.
    `;

    promptInstructions += `
    Also suggest a single Lucide React Native icon name that best represents this topic (e.g. "Brain", "Code", "History", "Calculator", "Globe", "Music", "FlaskConical").
    Return it in the "icon" field.
    `;

    if (includeSummary) {
      promptInstructions += `
${sectionIndex++}. SUMMARY:
   Generate a comprehensive, engaging summary in RICH MARKDOWN format.
   - Use a single string containing the entire summary.
   - Structure the content with H1 (#), H2 (##), and H3 (###) headers.
   - **CRITICAL**: Add relevant EMOJIS to the start of EVERY header (e.g., "🧪 Introduction", "🔗 Bonding Preferences", "💡 Key Concepts").
   - Use **bold** for key terms and definitions.
   - Use bullet points and numbered lists where appropriate.
   - Include a "Key Takeaways" section at the end.
   - The tone should be educational, clear, and engaging.
`;
      jsonStructure.summary = "# 🧪 Introduction\n\nContent here...\n\n## 🔗 Section 1\n\nDetails...";
    }

    if (includeQuiz) {
      promptInstructions += `
${sectionIndex++}. QUIZ: Generate EXACTLY 10 multiple choice questions (minimum 7, never less)
   - CRITICAL: You MUST generate at least 7 questions, ideally 10
   - Each question must have 4 options
   - Vary difficulty across questions
   - Include detailed explanations for correct answers
`;
      jsonStructure.quiz = [{
        question: "?",
        options: ["A", "B", "C", "D"],
        correctAnswer: 0,
        explanation: "Why"
      }];
    }

    if (includeFlashcards) {
      promptInstructions += `
${sectionIndex++}. FLASHCARDS: Generate EXACTLY 10 flashcards (minimum 7, never less)
   - CRITICAL: You MUST generate at least 7 flashcards, ideally 10
   - Each card should have a clear question and concise answer
   - Cover different aspects of the content
`;
      jsonStructure.flashcards = [{ question: "Q", answer: "A" }];
    }

    if (includeMindMap) {
      promptInstructions += `
${sectionIndex++}. MIND MAP: Hierarchical structure
   - Central Title: Max 50 chars
   - Branches: 4-6 main themes (max 30 chars each)
   - Items: 2-4 key points per branch (max 50 chars each)
   - Colors: #FF6B6B, #4ECDC4, #95E1D3, #F38181, #A8E6CF, #FFD3B6
`;
      jsonStructure.mindMap = {
        title: "Main Topic",
        branches: [{
          title: "Branch Name",
          color: "#FF6B6B",
          items: ["Point 1", "Point 2"]
        }]
      };
    }

    promptInstructions += `
FORMAT RULES:
- Single line breaks between paragraphs
- Markdown: ###, **, -, \`\`\`, | table |
- Clean, professional content

Return ONLY valid JSON matching this structure:
${JSON.stringify(jsonStructure, null, 2)}
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Expert educational content creator. Always return valid JSON.'
        },
        { role: 'user', content: promptInstructions }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 6000
    });

    const content = JSON.parse(response.choices[0].message.content);

    // Validate based on requested options
    if (includeSummary && !content.summary) throw new Error('Missing summary in AI response');
    if (includeQuiz && !content.quiz) throw new Error('Missing quiz in AI response');
    if (includeFlashcards && !content.flashcards) throw new Error('Missing flashcards in AI response');
    if (includeMindMap && !content.mindMap) throw new Error('Missing mindMap in AI response');

    // Clean text
    const cleanText = (text) => {
      if (!text) return text;
      return text
        .replace(/\n{3,}/g, '\n\n')
        .replace(/ {3,}/g, ' ')
        .trim();
    };

    if (content.summary && typeof content.summary === 'string') {
      content.summary = cleanText(content.summary);
    }

    // Shuffle quiz options to randomize correct answer position
    if (content.quiz && Array.isArray(content.quiz)) {
      content.quiz = content.quiz.map(q => {
        if (!q.options || q.options.length !== 4) return q;

        // Get the correct answer text before shuffling
        const correctAnswerText = q.options[q.correctAnswer];

        // Create array of indices and shuffle them
        const indices = [0, 1, 2, 3];
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }

        // Reorder options based on shuffled indices
        const shuffledOptions = indices.map(i => q.options[i]);

        // Find new position of correct answer
        const newCorrectIndex = shuffledOptions.indexOf(correctAnswerText);

        return {
          ...q,
          options: shuffledOptions,
          correctAnswer: newCorrectIndex
        };
      });
      console.log('   ✅ Quiz options shuffled for randomized answer positions');
    }

    console.log('✅ Content generated!');
    console.log(`   Title: ${content.title}`);
    if (content.summary) console.log(`   Summary Length: ${content.summary.length} chars`);
    if (content.quiz) console.log(`   Quiz: ${content.quiz.length}`);
    if (content.flashcards) console.log(`   Flashcards: ${content.flashcards.length}`);
    if (content.mindMap) console.log(`   Mind Map Branches: ${content.mindMap.branches?.length || 0}`);

    return {
      title: content.title,
      icon: content.icon || 'Book', // Default to Book if missing
      summary: content.summary || null,
      quiz: content.quiz || [],
      flashcards: content.flashcards || [],
      mindMap: content.mindMap || null,
      metadata: {
        model: 'gpt-4o-mini',
        difficulty,
        generatedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('❌ AI error:', error);
    throw new Error(`AI generation failed: ${error.message}`);
  }
};


/**
 * Clean text - remove excessive newlines and whitespace
 */
function cleanText(text) {
  if (!text) return text;

  return text
    // Replace 3+ newlines with double newline
    .replace(/\n{3,}/g, '\n\n')
    // Replace excessive spaces
    .replace(/ {3,}/g, '  ')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Remove leading/trailing whitespace
    .trim();
}

/**
 * Estimate word count
 */
function estimateWordCount(summary) {
  let text = '';

  if (summary.introduction) text += summary.introduction + ' ';
  if (summary.sections) {
    summary.sections.forEach(s => {
      text += s.content + ' ';
    });
  }
  if (summary.conclusion) text += summary.conclusion + ' ';

  return text.split(/\s+/).filter(w => w.length > 0).length;
}


// Extract YouTube transcript (placeholder for Week 2)
export const extractYouTubeTranscript = async (url) => {
  throw new Error('YouTube extraction not implemented yet. Coming in Week 2!');
};

// Extract PDF text (placeholder for Week 3)
export const extractPdfText = async (fileBuffer) => {
  throw new Error('PDF extraction not implemented yet. Coming in Week 3!');
};

// Transcribe audio (placeholder for Week 4)
export const transcribeAudio = async (audioBuffer) => {
  throw new Error('Audio transcription not implemented yet. Coming in Week 4!');
};

// Extract text from image (placeholder for Week 4)
export const extractImageText = async (imageUrl) => {
  throw new Error('Image OCR not implemented yet. Coming in Week 4!');
};

export const generateContentFromText = async (requestId, text, materials, difficulty, userId) => {
  try {
    // 1. Generate content
    const content = await generateContent(text, difficulty);

    // 2. Save to database
    // Save topic
    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .insert({
        user_id: userId,
        title: content.title,
        source_type: 'text',
        source_url: 'text_input',
        materials: content
      })
      .select()
      .single();

    if (topicError) throw topicError;

    // Update request status
    const { error: updateError } = await supabase
      .from('content_requests')
      .update({
        status: 'completed',
        progress: 100,
        result: content, // Store result in request too if needed, or just link to topic
        topic_id: topic.id
      })
      .eq('id', requestId);

    if (updateError) throw updateError;

  } catch (error) {
    console.error('Background generation error:', error);
    await supabase
      .from('content_requests')
      .update({
        status: 'failed',
        error: error.message
      })
      .eq('id', requestId);
  }
};

export default {
  generateContent,
  generateContentFromText,
  extractYouTubeTranscript,
  extractPdfText,
  transcribeAudio,
  extractImageText
};