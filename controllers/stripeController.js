import {
    createCheckoutSession,
    fetchPrices,
    verifyWebhookSignature,
    getSubscription,
    createCustomerPortalSession,
    getOrCreateCustomer
} from '../services/stripeService.js';
import { updateSubscriptionPlan } from '../services/supabaseService.js';
import supabase from '../config/supabase.js';

/**
 * Create Stripe checkout session
 * POST /api/stripe/create-checkout-session
 */
export const createCheckoutSessionController = async (req, res) => {
    try {
        const { priceId, userId, email, successUrl, cancelUrl } = req.body;

        console.log('═══════════════════════════════════════════════════════');
        console.log('💳 CREATE CHECKOUT SESSION REQUEST');
        console.log('═══════════════════════════════════════════════════════');
        console.log('Price ID:', priceId);
        console.log('User ID:', userId);
        console.log('Email:', email);
        console.log('Success URL:', successUrl);
        console.log('Cancel URL:', cancelUrl);

        if (!priceId || !userId || !email) {
            return res.status(400).json({
                error: 'Missing required fields: priceId, userId, and email are required'
            });
        }

        // Step 1: Get or create Stripe customer
        console.log('🔍 Getting or creating Stripe customer...');
        const customerId = await getOrCreateCustomer(userId, email);
        console.log('✅ Stripe customer ID:', customerId);

        // Use default URLs if not provided
        const defaultSuccessUrl = successUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/success?session_id={CHECKOUT_SESSION_ID}`;
        const defaultCancelUrl = cancelUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/cancelled`;

        // Step 2: Create checkout session with customer ID
        const session = await createCheckoutSession(
            priceId,
            userId,
            customerId, // Pass customer ID instead of email
            defaultSuccessUrl,
            defaultCancelUrl
        );

        console.log('✅ Checkout session created successfully');
        console.log('Session ID:', session.id);
        console.log('Checkout URL:', session.url);
        console.log('═══════════════════════════════════════════════════════');

        res.status(200).json({
            sessionId: session.id,
            url: session.url,
        });
    } catch (error) {
        console.error('❌ Error in createCheckoutSessionController:', error);
        res.status(500).json({
            error: 'Failed to create checkout session',
            details: error.message
        });
    }
};

/**
 * Get price details from Stripe
 * GET /api/stripe/prices
 */
export const getPricesController = async (req, res) => {
    try {
        const priceIds = [
            process.env.STRIPE_PRICE_WEEKLY,
            process.env.STRIPE_PRICE_MONTHLY,
            process.env.STRIPE_PRICE_YEARLY,
        ].filter(Boolean); // Remove any undefined values

        console.log('═══════════════════════════════════════════════════════');
        console.log('💰 FETCHING PRICES FROM STRIPE');
        console.log('═══════════════════════════════════════════════════════');
        console.log('Price IDs:', priceIds);

        if (priceIds.length === 0) {
            return res.status(500).json({
                error: 'No price IDs configured in environment variables'
            });
        }

        const prices = await fetchPrices(priceIds);

        // Format prices for frontend
        const formattedPrices = prices.map(price => ({
            id: price.id,
            amount: price.unit_amount / 100, // Convert from cents
            currency: price.currency,
            interval: price.recurring?.interval,
            intervalCount: price.recurring?.interval_count,
            product: {
                id: price.product.id,
                name: price.product.name,
                description: price.product.description,
            },
            metadata: price.metadata,
        }));

        console.log('✅ Prices fetched successfully:', formattedPrices.length);
        console.log('═══════════════════════════════════════════════════════');

        res.status(200).json({ prices: formattedPrices });
    } catch (error) {
        console.error('❌ Error in getPricesController:', error);
        res.status(500).json({
            error: 'Failed to fetch prices',
            details: error.message
        });
    }
};

/**
 * Create Stripe Customer Portal session
 * POST /api/stripe/create-portal-session
 */
export const createCustomerPortalSessionController = async (req, res) => {
    try {
        const { userId } = req.body;

        console.log('═══════════════════════════════════════════════════════');
        console.log('🔐 CREATE CUSTOMER PORTAL SESSION');
        console.log('═══════════════════════════════════════════════════════');
        console.log('User ID:', userId);

        if (!userId) {
            return res.status(400).json({
                error: 'Missing required field: userId'
            });
        }

        // Get user's Stripe customer ID from database
        const { data: userProfile, error } = await supabase
            .from('user_profiles')
            .select('stripe_customer_id')
            .eq('id', userId)
            .single();

        if (error || !userProfile?.stripe_customer_id) {
            console.error('❌ No Stripe customer found for user:', userId);
            return res.status(404).json({
                error: 'No Stripe customer found for this user'
            });
        }

        console.log('✅ Found customer ID:', userProfile.stripe_customer_id);

        // Create portal session
        const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/app/profile`;
        const session = await createCustomerPortalSession(userProfile.stripe_customer_id, returnUrl);

        console.log('✅ Portal session created successfully');
        console.log('Portal URL:', session.url);
        console.log('═══════════════════════════════════════════════════════');

        res.status(200).json({
            url: session.url,
        });
    } catch (error) {
        console.error('❌ Error in createCustomerPortalSessionController:', error);
        res.status(500).json({
            error: 'Failed to create customer portal session',
            details: error.message
        });
    }
};

/**
 * Handle Stripe webhook events
 * POST /api/stripe/webhook
 */
export const handleStripeWebhook = async (req, res) => {
    const signature = req.headers['stripe-signature'];
    const payload = req.body;

    console.log('═══════════════════════════════════════════════════════');
    console.log('🔔 STRIPE WEBHOOK RECEIVED');
    console.log('═══════════════════════════════════════════════════════');

    try {
        // Verify webhook signature
        const event = verifyWebhookSignature(payload, signature);

        console.log('Event Type:', event.type);
        console.log('Event ID:', event.id);

        let userId = null;
        let newPlan = null;
        let newStatus = null;
        let productId = null;
        let planType = null;
        let expiresAt = null;
        let subscriptionId = null;

        // Handle different event types
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                userId = session.client_reference_id || session.metadata?.userId;

                console.log('💳 Checkout completed');
                console.log('Session ID:', session.id);
                console.log('User ID:', userId);
                console.log('Subscription ID:', session.subscription);

                if (session.subscription) {
                    const subscription = await getSubscription(session.subscription);
                    productId = subscription.items.data[0]?.price.id;
                    subscriptionId = subscription.id;

                    // Safe date conversion - check if current_period_end exists
                    if (subscription.current_period_end) {
                        expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
                    }

                    // Determine plan type from price ID
                    if (productId === process.env.STRIPE_PRICE_WEEKLY) {
                        planType = 'weekly';
                    } else if (productId === process.env.STRIPE_PRICE_MONTHLY) {
                        planType = 'monthly';
                    } else if (productId === process.env.STRIPE_PRICE_YEARLY) {
                        planType = 'yearly';
                    }

                    newPlan = 'unlimited';
                    newStatus = 'active';
                }
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                userId = subscription.metadata?.userId;
                productId = subscription.items.data[0]?.price.id;
                subscriptionId = subscription.id;

                // Safe date conversion
                if (subscription.current_period_end) {
                    expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
                }

                console.log('📋 Subscription event:', event.type);
                console.log('Subscription ID:', subscription.id);
                console.log('User ID:', userId);
                console.log('Status:', subscription.status);
                console.log('Expires At:', expiresAt);

                // Determine plan type
                if (productId === process.env.STRIPE_PRICE_WEEKLY) {
                    planType = 'weekly';
                } else if (productId === process.env.STRIPE_PRICE_MONTHLY) {
                    planType = 'monthly';
                } else if (productId === process.env.STRIPE_PRICE_YEARLY) {
                    planType = 'yearly';
                }

                if (subscription.status === 'active' || subscription.status === 'trialing') {
                    newPlan = 'unlimited';
                    newStatus = 'active';
                } else if (subscription.status === 'canceled') {
                    newPlan = 'unlimited';
                    newStatus = 'cancelled';
                } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
                    newPlan = 'unlimited';
                    newStatus = 'past_due';
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                userId = subscription.metadata?.userId;
                subscriptionId = subscription.id;

                console.log('❌ Subscription deleted');
                console.log('Subscription ID:', subscription.id);
                console.log('User ID:', userId);

                newPlan = 'free';
                newStatus = 'expired';
                expiresAt = new Date().toISOString(); // Set to now
                break;
            }

            case 'invoice.payment_succeeded': {
                const invoice = event.data.object;
                userId = invoice.subscription_details?.metadata?.userId;
                subscriptionId = invoice.subscription;

                console.log('💰 Invoice payment succeeded');
                console.log('Invoice ID:', invoice.id);
                console.log('User ID:', userId);
                console.log('Subscription ID:', subscriptionId);

                if (subscriptionId) {
                    const subscription = await getSubscription(subscriptionId);
                    productId = subscription.items.data[0]?.price.id;

                    // Safe date conversion
                    if (subscription.current_period_end) {
                        expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
                    }

                    // Determine plan type
                    if (productId === process.env.STRIPE_PRICE_WEEKLY) {
                        planType = 'weekly';
                    } else if (productId === process.env.STRIPE_PRICE_MONTHLY) {
                        planType = 'monthly';
                    } else if (productId === process.env.STRIPE_PRICE_YEARLY) {
                        planType = 'yearly';
                    }

                    newPlan = 'unlimited';
                    newStatus = 'active';
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                userId = invoice.subscription_details?.metadata?.userId;
                subscriptionId = invoice.subscription;

                console.log('❌ Invoice payment failed');
                console.log('Invoice ID:', invoice.id);
                console.log('User ID:', userId);
                console.log('Subscription ID:', subscriptionId);

                if (subscriptionId) {
                    const subscription = await getSubscription(subscriptionId);
                    productId = subscription.items.data[0]?.price.id;

                    // Determine plan type
                    if (productId === process.env.STRIPE_PRICE_WEEKLY) {
                        planType = 'weekly';
                    } else if (productId === process.env.STRIPE_PRICE_MONTHLY) {
                        planType = 'monthly';
                    } else if (productId === process.env.STRIPE_PRICE_YEARLY) {
                        planType = 'yearly';
                    }

                    newPlan = 'unlimited';
                    newStatus = 'past_due';
                }
                break;
            }

            default:
                console.log('ℹ️ Unhandled event type:', event.type);
        }

        // Update database if we have user info and plan changes
        if (userId && newPlan) {
            console.log('');
            console.log('💾 UPDATING DATABASE:');
            console.log('User ID:', userId);
            console.log('New Plan:', newPlan);
            console.log('New Status:', newStatus);
            console.log('Product ID:', productId);
            console.log('Plan Type:', planType);
            console.log('Expires At:', expiresAt);
            console.log('Subscription Source: stripe');

            try {
                await updateSubscriptionPlan(
                    userId,
                    newPlan,
                    newStatus,
                    subscriptionId, // Store Stripe subscription ID in revenuecat_customer_id field (or create new field)
                    productId,
                    planType,
                    'stripe', // subscription_source
                    expiresAt // expiration date
                );
                console.log('✅ Database updated successfully');
            } catch (dbError) {
                console.error('❌ Database update failed:', dbError);
                // Don't throw - we still want to acknowledge the webhook
            }
        }

        console.log('═══════════════════════════════════════════════════════');

        // Always respond with 200 to acknowledge receipt
        res.status(200).json({ received: true });
    } catch (error) {
        console.error('❌ Webhook error:', error);
        console.error('Error details:', error.message);
        console.log('═══════════════════════════════════════════════════════');

        // Return 400 for signature verification failures
        res.status(400).json({
            error: 'Webhook error',
            details: error.message
        });
    }
};
