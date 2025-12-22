import { extractYouTubeTranscript, checkVideoAvailability } from '../services/youtubeService.js';
import { TranscriptError, TRANSCRIPT_ERRORS, ERROR_MESSAGES, detectErrorType } from '../services/youtubeErrors.js';

/**
 * Express Controller to handle the transcript request.
 */
export const getTranscript = async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: {
        code: TRANSCRIPT_ERRORS.INVALID_URL,
        message: 'YouTube URL is required in the request body.',
        userMessage: 'Please provide a YouTube URL.',
        canRetry: false,
        suggestAudioTranscription: false,
      }
    });
  }

  try {
    const { text, title, duration, videoId } = await extractYouTubeTranscript(url);

    res.status(200).json({
      success: true,
      url: url,
      transcript: text,
      metadata: { title, duration, videoId }
    });
  } catch (error) {
    // Handle TranscriptError (structured errors)
    if (error instanceof TranscriptError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.toJSON()
      });
    }

    // Handle unexpected errors - try to detect error type
    const errorCode = detectErrorType(error);
    const transcriptError = new TranscriptError(errorCode, error.message, {
      originalError: error.message,
    });

    return res.status(transcriptError.statusCode).json({
      success: false,
      error: transcriptError.toJSON()
    });
  }
};

/**
 * Pre-flight check endpoint - check video availability before extraction
 */
export const checkVideo = async (req, res) => {
  const { videoId } = req.params;
  const { url } = req.query;

  // Accept either videoId param or url query
  let targetVideoId = videoId;

  if (!targetVideoId && url) {
    // Extract from URL
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    targetVideoId = match ? match[1] : null;
  }

  if (!targetVideoId) {
    return res.status(400).json({
      success: false,
      error: {
        code: TRANSCRIPT_ERRORS.INVALID_URL,
        message: 'Video ID or URL is required',
        userMessage: 'Please provide a valid YouTube URL or video ID.',
        canRetry: false,
      }
    });
  }

  try {
    const availability = await checkVideoAvailability(targetVideoId);

    res.status(200).json({
      success: true,
      ...availability,
      // Add user-friendly status message
      statusMessage: availability.error
        ? ERROR_MESSAGES[availability.error]
        : availability.hasCaptions
          ? 'Video is ready for transcript extraction'
          : 'Video found but may not have captions available',
    });
  } catch (error) {
    const errorCode = detectErrorType(error);
    return res.status(500).json({
      success: false,
      error: {
        code: errorCode,
        message: error.message,
        userMessage: ERROR_MESSAGES[errorCode] || error.message,
        canRetry: true,
      }
    });
  }
};