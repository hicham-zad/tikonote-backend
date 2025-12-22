import express from 'express';
import { insertContent, getContentStatus, listContent } from '../controllers/contentController.js';
import { authenticateUser } from '../middleware/supabaseAuth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// POST /api/content/insert - Insert new YouTube content
router.post('/insert', insertContent);

// GET /api/content/list - List user's content
router.get('/list', listContent);

// GET /api/content/:id - Get content status (for polling)
router.get('/:id', getContentStatus);

export default router;
