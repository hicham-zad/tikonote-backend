import { getSubtitles, getVideoDetails } from 'youtube-caption-extractor';

export const extractYouTubeTranscript = async (url) => {
  const videoId = extractVideoId(url);
  console.log(`🎥 Extracting transcript for video ID: ${videoId}`);
  console.log(`⚡️ Using youtube-caption-extractor`);

  try {
    // Attempt to get video details including subtitles
    const videoDetails = await getVideoDetails({ videoID: videoId, lang: 'en' });

    console.log(`📺 Video: ${videoDetails.title}`);

    if (videoDetails.subtitles && videoDetails.subtitles.length > 0) {
      const text = videoDetails.subtitles
        .map(s => s.text)
        .join(' ');

      console.log(`✅ Successfully extracted transcript (${text.length} characters)`);

      return {
        text,
        title: videoDetails.title,
        duration: null, // This library doesn't return total duration easily
        videoId,
      };
    }

    // Fallback: Try getting just subtitles if details failed to have them
    const subtitles = await getSubtitles({ videoID: videoId, lang: 'en' });

    if (subtitles && subtitles.length > 0) {
      const text = subtitles.map(s => s.text).join(' ');
      console.log(`✅ Successfully extracted subtitles only (${text.length} characters)`);

      return {
        text,
        title: videoDetails.title || `YouTube Video ${videoId}`,
        duration: null,
        videoId
      };
    }

    throw new Error('No subtitles found for this video');

  } catch (error) {
    console.error('❌ Transcript extraction failed:', error.message);
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