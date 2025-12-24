import express from 'express';
import {
    createCheckoutSession,
    fetchPrices,
    verifyWebhookSignature,
    getSubscription,
    createCustomerPortalSession,
    getOrCreateCustomer
} from '../services/stripeService.js';
import { updateSubscriptionPlan } from '../services/supabaseService.js';
import {
    createCheckoutSessionController,
    getPricesController,
    createCustomerPortalSessionController,
    handleStripeWebhook
} from '../controllers/stripeController.js';

const router = express.Router();

// Create checkout session
router.post('/create-checkout-session', createCheckoutSessionController);

// Get prices
router.get('/prices', getPricesController);

// Create customer portal session
router.post('/create-portal-session', createCustomerPortalSessionController);

// Webhook endpoint (must use raw body)
router.post('/webhook', handleStripeWebhook);

export default router;
