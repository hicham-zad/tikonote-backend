/**
 * YouTube Transcript Error Handling
 * Structured error codes and user-friendly messages
 */

// Error codes for specific failure scenarios
export const TRANSCRIPT_ERRORS = {
    INVALID_URL: 'INVALID_URL',
    VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
    VIDEO_PRIVATE: 'VIDEO_PRIVATE',
    VIDEO_AGE_RESTRICTED: 'VIDEO_AGE_RESTRICTED',
    VIDEO_LIVE_STREAM: 'VIDEO_LIVE_STREAM',
    VIDEO_TOO_LONG: 'VIDEO_TOO_LONG',
    NO_CAPTIONS_AVAILABLE: 'NO_CAPTIONS_AVAILABLE',
    REGION_BLOCKED: 'REGION_BLOCKED',
    EXTRACTION_FAILED: 'EXTRACTION_FAILED',
    RATE_LIMITED: 'RATE_LIMITED',
    NETWORK_ERROR: 'NETWORK_ERROR',
};

// User-friendly error messages (English)
export const ERROR_MESSAGES = {
    [TRANSCRIPT_ERRORS.INVALID_URL]: 'Invalid YouTube URL format. Please check the link and try again.',
    [TRANSCRIPT_ERRORS.VIDEO_NOT_FOUND]: 'This video does not exist or has been deleted.',
    [TRANSCRIPT_ERRORS.VIDEO_PRIVATE]: 'This video is private. Only public videos can be transcribed.',
    [TRANSCRIPT_ERRORS.VIDEO_AGE_RESTRICTED]: 'Age-restricted videos cannot be transcribed automatically.',
    [TRANSCRIPT_ERRORS.VIDEO_LIVE_STREAM]: 'Live streams cannot be transcribed. Please wait until the stream ends.',
    [TRANSCRIPT_ERRORS.VIDEO_TOO_LONG]: 'Videos longer than 3 hours cannot be transcribed.',
    [TRANSCRIPT_ERRORS.NO_CAPTIONS_AVAILABLE]: 'No captions available for this video. The creator may not have added subtitles.',
    [TRANSCRIPT_ERRORS.REGION_BLOCKED]: 'This video is not available in your region.',
    [TRANSCRIPT_ERRORS.EXTRACTION_FAILED]: 'Failed to extract transcript. Please try again later.',
    [TRANSCRIPT_ERRORS.RATE_LIMITED]: 'Too many requests. Please wait a moment and try again.',
    [TRANSCRIPT_ERRORS.NETWORK_ERROR]: 'Network error. Please check your connection and try again.',
};

// HTTP status codes for each error type
export const ERROR_STATUS_CODES = {
    [TRANSCRIPT_ERRORS.INVALID_URL]: 400,
    [TRANSCRIPT_ERRORS.VIDEO_NOT_FOUND]: 404,
    [TRANSCRIPT_ERRORS.VIDEO_PRIVATE]: 403,
    [TRANSCRIPT_ERRORS.VIDEO_AGE_RESTRICTED]: 403,
    [TRANSCRIPT_ERRORS.VIDEO_LIVE_STREAM]: 400,
    [TRANSCRIPT_ERRORS.VIDEO_TOO_LONG]: 400,
    [TRANSCRIPT_ERRORS.NO_CAPTIONS_AVAILABLE]: 404,
    [TRANSCRIPT_ERRORS.REGION_BLOCKED]: 403,
    [TRANSCRIPT_ERRORS.EXTRACTION_FAILED]: 500,
    [TRANSCRIPT_ERRORS.RATE_LIMITED]: 429,
    [TRANSCRIPT_ERRORS.NETWORK_ERROR]: 503,
};

// Which errors are worth retrying
export const RETRIABLE_ERRORS = [
    TRANSCRIPT_ERRORS.EXTRACTION_FAILED,
    TRANSCRIPT_ERRORS.RATE_LIMITED,
    TRANSCRIPT_ERRORS.NETWORK_ERROR,
];

// Error suggests audio transcription as fallback
export const SUGGEST_AUDIO_TRANSCRIPTION = [
    TRANSCRIPT_ERRORS.NO_CAPTIONS_AVAILABLE,
];

/**
 * Custom error class for YouTube transcript errors
 */
export class TranscriptError extends Error {
    constructor(code, customMessage = null, details = {}) {
        const message = customMessage || ERROR_MESSAGES[code] || 'Unknown error occurred';
        super(message);

        this.name = 'TranscriptError';
        this.code = code;
        this.statusCode = ERROR_STATUS_CODES[code] || 500;
        this.canRetry = RETRIABLE_ERRORS.includes(code);
        this.suggestAudioTranscription = SUGGEST_AUDIO_TRANSCRIPTION.includes(code);
        this.details = details;
        this.userMessage = ERROR_MESSAGES[code] || message;
    }

    toJSON() {
        return {
            code: this.code,
            message: this.message,
            userMessage: this.userMessage,
            canRetry: this.canRetry,
            suggestAudioTranscription: this.suggestAudioTranscription,
            details: this.details,
        };
    }
}

/**
 * Helper to detect error type from error message
 */
export const detectErrorType = (error) => {
    const msg = error.message?.toLowerCase() || '';

    // Check for specific patterns
    if (msg.includes('private') || msg.includes('sign in')) {
        return TRANSCRIPT_ERRORS.VIDEO_PRIVATE;
    }
    if (msg.includes('age') || msg.includes('restricted') || msg.includes('confirm your age')) {
        return TRANSCRIPT_ERRORS.VIDEO_AGE_RESTRICTED;
    }
    if (msg.includes('not found') || msg.includes('does not exist') || msg.includes('unavailable')) {
        return TRANSCRIPT_ERRORS.VIDEO_NOT_FOUND;
    }
    if (msg.includes('live') || msg.includes('premiere')) {
        return TRANSCRIPT_ERRORS.VIDEO_LIVE_STREAM;
    }
    if (msg.includes('no caption') || msg.includes('transcript is disabled') || msg.includes('subtitles')) {
        return TRANSCRIPT_ERRORS.NO_CAPTIONS_AVAILABLE;
    }
    if (msg.includes('blocked') || msg.includes('country') || msg.includes('region')) {
        return TRANSCRIPT_ERRORS.REGION_BLOCKED;
    }
    if (msg.includes('rate') || msg.includes('too many') || msg.includes('429')) {
        return TRANSCRIPT_ERRORS.RATE_LIMITED;
    }
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('econnrefused')) {
        return TRANSCRIPT_ERRORS.NETWORK_ERROR;
    }
    if (msg.includes('invalid') && (msg.includes('url') || msg.includes('id'))) {
        return TRANSCRIPT_ERRORS.INVALID_URL;
    }

    return TRANSCRIPT_ERRORS.EXTRACTION_FAILED;
};
