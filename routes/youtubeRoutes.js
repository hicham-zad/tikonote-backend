import express from 'express';
import { getTranscript, checkVideo } from '../controllers/youtubeController.js';
import * as youtubeContentController from '../controllers/youtubeContentController.js';
import * as youtubeValidationController from '../controllers/youtubeValidationController.js';
import { authenticateUser } from '../middleware/supabaseAuth.js';
import {
    youtubeValidateLimiter,
    youtubeTranscriptSaveLimiter,
    generationLimiter
} from '../middleware/rateLimiter.js';

const router = express.Router();

// ============================================
// NEW CLIENT-SIDE EXTRACTION ENDPOINTS
// ============================================

// Pre-flight check: Check video availability and caption status before extraction
// GET /api/youtube/check/:videoId  OR  GET /api/youtube/check?url=...
router.get('/check/:videoId?', youtubeValidateLimiter, checkVideo);

// Validate YouTube URL and get video ID (no auth required for validation)
// POST /api/youtube/validate
router.post('/validate', youtubeValidateLimiter, youtubeValidationController.validateUrl);

// Save transcript from client-side extraction
// POST /api/youtube/transcript/save
router.post('/transcript/save', authenticateUser, youtubeTranscriptSaveLimiter, youtubeValidationController.saveTranscript);

// Get cached transcript by video ID
// GET /api/youtube/transcript/:videoId
router.get('/transcript/:videoId', authenticateUser, youtubeValidationController.getTranscript);

// Get user's saved transcripts list
// GET /api/youtube/transcripts
router.get('/transcripts', authenticateUser, youtubeValidationController.getUserTranscripts);

// ============================================
// LEGACY ENDPOINTS (kept for compatibility)
// ============================================

// Legacy: Server-side transcript extraction (may not work on Render due to IP blocking)
// POST /api/youtube/transcript
router.post('/transcript', getTranscript);

// Generate AI content from YouTube URL (uses client-provided transcript now)
// POST /api/youtube/generate
router.post('/generate', authenticateUser, generationLimiter, youtubeContentController.generateContent);

// Check generation status
// GET /api/youtube/status/:requestId
router.get('/status/:requestId', authenticateUser, youtubeContentController.getGenerationStatus);

export default router;