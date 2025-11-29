-- Add Subscription Plan and Topic Limit Tracking
-- Run this in Supabase SQL Editor

-- 1. Add subscription plan columns to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS topics_created_count INTEGER DEFAULT 0;

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_plan ON user_profiles(subscription_plan);

-- 3. Update existing users to have default values
UPDATE user_profiles 
SET subscription_plan = 'free', 
    topics_created_count = (
      SELECT COUNT(*) 
      FROM topics 
      WHERE topics."userId" = user_profiles.id
    )
WHERE subscription_plan IS NULL;

-- Migration complete!
-- Users now have subscription_plan (free/unlimited) and topics_created_count tracking
