-- Migration: Add subscription tracking fields for cross-platform sync
-- Date: 2025-12-24
-- Description: Adds subscription_source, expires_at, and stripe_customer_id columns to user_profiles table
--              to enable subscription syncing between Stripe (web) and RevenueCat (mobile)

-- Add subscription_source column to track payment platform
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_source TEXT;

-- Add expires_at column to track subscription expiration
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add stripe_customer_id column to store Stripe customer ID
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add comment to subscription_source column
COMMENT ON COLUMN user_profiles.subscription_source IS 'Payment platform: stripe or revenuecat';

-- Add comment to expires_at column
COMMENT ON COLUMN user_profiles.expires_at IS 'Subscription expiration timestamp';

-- Add comment to stripe_customer_id column
COMMENT ON COLUMN user_profiles.stripe_customer_id IS 'Stripe customer ID for payment management';

-- Create index on subscription_source for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_source 
ON user_profiles(subscription_source);

-- Create index on expires_at for faster expiration checks
CREATE INDEX IF NOT EXISTS idx_user_profiles_expires_at 
ON user_profiles(expires_at);

-- Create index on stripe_customer_id for faster customer lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id 
ON user_profiles(stripe_customer_id);

-- Optional: Add a check constraint to ensure subscription_source is valid
ALTER TABLE user_profiles
ADD CONSTRAINT check_subscription_source 
CHECK (subscription_source IS NULL OR subscription_source IN ('stripe', 'revenuecat'));

-- Migration complete
-- Next steps:
-- 1. Run this migration in your Supabase SQL editor
-- 2. Configure Stripe webhook in Dashboard with the events shown in your screenshot
-- 3. Test the subscription flow on both web and mobile platforms
