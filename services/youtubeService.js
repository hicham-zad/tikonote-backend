import { YoutubeTranscript } from '@danielxceron/youtube-transcript';

export const extractYouTubeTranscript = async (url) => {
  try {
    const videoId = extractVideoId(url);
    console.log(`🎥 Attempting to extract transcript for video ID: ${videoId}`);
    console.log(`📺 Full URL: ${url}`);

    // Use the more reliable fork with dual extraction methods
    // This package tries HTML scraping first, then falls back to InnerTube API
    const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);

    console.log(`✅ Transcript data received, segments: ${transcriptData?.length || 0}`);

    if (!transcriptData || transcriptData.length === 0) {
      console.error('❌ Transcript data is empty');
      throw new Error('No transcript available for this video. Please ensure the video has captions enabled.');
    }

    // Combine all transcript segments into a single text
    const text = transcriptData
      .map(segment => segment.text)
      .join(' ');

    console.log(`📝 Transcript extracted successfully, length: ${text.length} characters`);

    return {
      text,
      title: `YouTube Video ${videoId}`,
      duration: null,
      videoId
    };
  } catch (error) {
    console.error('❌ YouTube transcript extraction error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack?.substring(0, 200), // Truncate stack trace
      name: error.name
    });

    // Handle specific errors
    if (error.message && (error.message.includes('Could not find') || error.message.includes('Transcript is disabled') || error.message.includes('No transcript'))) {
      throw new Error('No transcript available for this video. The video may not have captions, or captions may be disabled by the creator.');
    }

    if (error.message && error.message.includes('disabled')) {
      throw new Error('Transcripts are disabled for this video.');
    }

    if (error.message && error.message.includes('Invalid')) {
      throw new Error('Invalid YouTube URL or video ID.');
    }

    // Re-throw with user-friendly message
    throw new Error(`Unable to extract transcript: ${error.message}`);
  }
};

// Helper to extract video ID from various YouTube URL formats
export const extractVideoId = (url) => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/, // Support YouTube Shorts
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  throw new Error('Invalid YouTube URL');
};