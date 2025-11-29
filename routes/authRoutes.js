import express from 'express';
import * as authController from '../controllers/authController.js';
import { authenticateUser } from '../middleware/supabaseAuth.js';

const router = express.Router();

// Public routes
router.post('/signup', authController.signUpWithEmail);
router.post('/signin', authController.signInWithEmail);
router.post('/google', authController.signInWithGoogle);
router.post('/apple', authController.signInWithApple);
router.post('/oauth', authController.signInWithOAuth);
router.post('/oauth/callback', authController.handleOAuthCallback);
router.post('/refresh', authController.refreshToken);

// Protected routes (require authentication)
router.post('/signout', authenticateUser, authController.signOut);
router.get('/me', authenticateUser, authController.getCurrentUser);
router.put('/profile', authenticateUser, authController.updateProfile);
router.delete('/account', authenticateUser, authController.deleteAccount);

export default router;
