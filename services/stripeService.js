import Stripe from 'stripe';
import supabase from '../config/supabase.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a Stripe checkout session
 * @param {string} priceId - Stripe price ID
 * @param {string} userId - User ID from your database
 * @param {string} customerId - Stripe customer ID
 * @param {string} successUrl - URL to redirect after successful payment
 * @param {string} cancelUrl - URL to redirect if payment is cancelled
 * @returns {Promise<object>} Checkout session object
 */
export const createCheckoutSession = async (priceId, userId, customerId, successUrl, cancelUrl) => {
    try {
        // Map price IDs to their corresponding Stripe coupon IDs
        // These coupons are already configured in Stripe Dashboard
        const priceToCouponMap = {
            [process.env.STRIPE_PRICE_WEEKLY]: 'V8VNiscQ', // Weekly Plan Discount - 30% off once
            [process.env.STRIPE_PRICE_MONTHLY]: 'vZSCz2zN', // Monthly Plan Discount - 35% off once
            [process.env.STRIPE_PRICE_YEARLY]: 'n8MirGtZ', // Yearly Plan Discount - Fixed $70 off ($49.99 first year)
        };

        const sessionConfig = {
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
            customer: customerId, // Use customer ID - email will be prefilled from customer record
            client_reference_id: userId,
            metadata: {
                userId: userId,
            },
            subscription_data: {
                metadata: {
                    userId: userId,
                },
            },
        };

        // Automatically apply coupon if available for this price
        const couponId = priceToCouponMap[priceId];
        if (couponId) {
            sessionConfig.discounts = [{
                coupon: couponId,
            }];
            console.log(`✅ Applying coupon ${couponId} to checkout session for price ${priceId}`);
        } else {
            // Only allow manual promotion codes if no automatic discount is applied
            sessionConfig.allow_promotion_codes = true;
        }

        const session = await stripe.checkout.sessions.create(sessionConfig);

        console.log('✅ Stripe checkout session created:', session.id);
        return session;
    } catch (error) {
        console.error('❌ Error creating checkout session:', error);
        throw error;
    }
};

/**
 * Fetch price details from Stripe
 * @param {string[]} priceIds - Array of Stripe price IDs
 * @returns {Promise<object[]>} Array of price objects with details
 */
export const fetchPrices = async (priceIds) => {
    try {
        const prices = await Promise.all(
            priceIds.map(async (priceId) => {
                const price = await stripe.prices.retrieve(priceId, {
                    expand: ['product'],
                });
                return price;
            })
        );

        console.log('✅ Fetched prices from Stripe:', prices.length);
        return prices;
    } catch (error) {
        console.error('❌ Error fetching prices:', error);
        throw error;
    }
};

/**
 * Create a Stripe Customer Portal session
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<object>} Portal session object
 */
export const createCustomerPortalSession = async (customerId) => {
    try {
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/app/profile`,
        });

        console.log('✅ Customer portal session created:', session.id);
        return session;
    } catch (error) {
        console.error('❌ Error creating customer portal session:', error);
        throw error;
    }
};

/**
 * Get or create Stripe customer for a user
 * @param {string} userId - User ID from database
 * @param {string} email - User email
 * @returns {Promise<string>} Stripe customer ID
 */
export const getOrCreateCustomer = async (userId, email) => {
    try {
        // First, check if we have a customer ID in our database
        const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('stripe_customer_id')
            .eq('id', userId)
            .single();

        if (userProfile?.stripe_customer_id) {
            console.log('✅ Found existing customer ID in database:', userProfile.stripe_customer_id);
            return userProfile.stripe_customer_id;
        }

        // Search for existing customer in Stripe by email
        const customers = await stripe.customers.list({
            email: email,
            limit: 1,
        });

        let customerId;

        if (customers.data.length > 0) {
            customerId = customers.data[0].id;
            console.log('✅ Found existing Stripe customer:', customerId);
        } else {
            // Create new customer
            const customer = await stripe.customers.create({
                email: email,
                metadata: {
                    userId: userId,
                },
            });
            customerId = customer.id;
            console.log('✅ Created new Stripe customer:', customerId);
        }

        // Store customer ID in database for future use
        await supabase
            .from('user_profiles')
            .update({ stripe_customer_id: customerId })
            .eq('id', userId);

        console.log('✅ Stored customer ID in database');
        return customerId;
    } catch (error) {
        console.error('❌ Error getting/creating customer:', error);
        throw error;
    }
};

/**
 * Verify Stripe webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - Stripe signature header
 * @returns {object} Verified event object
 */
export const verifyWebhookSignature = (payload, signature) => {
    try {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!webhookSecret) {
            throw new Error('STRIPE_WEBHOOK_SECRET is not set in environment variables');
        }

        const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
        console.log('✅ Webhook signature verified:', event.type);
        return event;
    } catch (error) {
        console.error('❌ Webhook signature verification failed:', error.message);
        throw error;
    }
};

/**
 * Get subscription details
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<object>} Subscription object
 */
export const getSubscription = async (subscriptionId) => {
    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        return subscription;
    } catch (error) {
        console.error('❌ Error fetching subscription:', error);
        throw error;
    }
};

/**
 * Cancel subscription
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<object>} Cancelled subscription object
 */
export const cancelSubscription = async (subscriptionId) => {
    try {
        const subscription = await stripe.subscriptions.cancel(subscriptionId);
        console.log('✅ Subscription cancelled:', subscriptionId);
        return subscription;
    } catch (error) {
        console.error('❌ Error cancelling subscription:', error);
        throw error;
    }
};
