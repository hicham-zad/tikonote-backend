import supabase from '../config/supabase.js';

// Update createTopic to include difficulty
export const createTopic = async (topicData) => {
  const { data, error } = await supabase
    .from('topics')
    .insert(topicData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Get topic by ID
export const getTopicById = async (topicId) => {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('id', topicId)
    .single();

  if (error) throw error;
  return data;
};

// Update topic status
export const updateTopicStatus = async (topicId, status, updates = {}) => {
  const { data, error } = await supabase
    .from('topics')
    .update({
      status,
      ...updates,
      updatedAt: new Date().toISOString()
    })
    .eq('id', topicId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Update progress
export const updateProgress = async (topicId, progress) => {
  const { data, error } = await supabase
    .from('topics')
    .update({ progress })
    .eq('id', topicId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Update topic title
export const updateTopicTitle = async (topicId, title) => {
  const { data, error } = await supabase
    .from('topics')
    .update({ title })
    .eq('id', topicId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Check if topic exists by title for user
export const checkTopicExists = async (userId, title) => {
  const { data, error } = await supabase
    .from('topics')
    .select('id')
    .eq('userId', userId)
    .eq('title', title)
    .maybeSingle();

  if (error) throw error;
  return !!data;
};
// Save processed content with HTML
// backend/services/supabaseService.js

export const saveProcessedContent = async (topicId, content) => {
  try {
    console.log('💾 Saving to database...');

    const { data, error } = await supabase
      .from('topics')
      .update({
        summary: content.summary,        // Saved as JSONB
        summaryHTML: null,               // Not used yet
        quiz: content.quiz,
        flashcards: content.flashcards,
        mindMap: content.mindMap,
        emoji: content.icon,             // Save AI icon name to emoji column
        status: 'completed',
        progress: 100,
        completedAt: new Date().toISOString()
      })
      .eq('id', topicId)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Saved successfully!');
    return data;
  } catch (error) {
    console.error('❌ Save error:', error);
    throw error;
  }
};

// Get user's topics
export const getUserTopics = async (userId, page = 1, limit = 8, filter = 'recent') => {
  console.log(`📊 Getting topics for user ${userId} with filter: ${filter}, page: ${page}, limit: ${limit}`);

  let query = supabase
    .from('topics')
    .select('*', { count: 'exact' }) // Request total count
    .eq('userId', userId);

  // Apply date filter
  if (filter === 'week') {
    // This week: last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    console.log(`📅 This week filter: showing topics from ${weekAgo.toISOString()} onwards`);
    query = query.gte('createdAt', weekAgo.toISOString());
  } else if (filter === 'month') {
    // Last month: between 8 and 37 days ago (excludes this week)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 37);
    console.log(`📅 Last month filter: showing topics from ${monthAgo.toISOString()} to ${weekAgo.toISOString()}`);
    query = query
      .gte('createdAt', monthAgo.toISOString())
      .lt('createdAt', weekAgo.toISOString());
  } else {
    console.log(`📅 Recent filter: showing all topics`);
  }
  // 'recent' = no filter, show all

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, count, error } = await query
    .order('createdAt', { ascending: false })
    .range(from, to);

  if (error) throw error;

  console.log(`✅ Found ${data.length} topics (Total: ${count})`);
  return { data, count };
};

// Delete topic
export const deleteTopic = async (topicId) => {
  const { error } = await supabase
    .from('topics')
    .delete()
    .eq('id', topicId);

  if (error) throw error;
};

// Upload file to storage
export const uploadFile = async (bucket, filePath, file, contentType) => {
  const { data, error } = await supabase
    .storage
    .from(bucket)
    .upload(filePath, file, {
      contentType,
      upsert: false
    });

  if (error) throw error;
  return data;
};

// Get file URL
export const getFileUrl = (bucket, filePath) => {
  const { data } = supabase
    .storage
    .from(bucket)
    .getPublicUrl(filePath);

  return data.publicUrl;
};

// Download file from storage
export const downloadFile = async (bucket, filePath) => {
  const { data, error } = await supabase
    .storage
    .from(bucket)
    .download(filePath);

  if (error) throw error;
  return data;
};

// Delete file
export const deleteFile = async (bucket, filePath) => {
  const { error } = await supabase
    .storage
    .from(bucket)
    .remove([filePath]);

  if (error) throw error;
};

// Store device token for push notifications
export const storeDeviceToken = async (userId, token, platform) => {
  const { data, error } = await supabase
    .from('device_tokens')
    .upsert({
      userId,
      token,
      platform,
      updatedAt: new Date().toISOString()
    }, {
      onConflict: 'token'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Get user's device tokens
export const getUserDeviceTokens = async (userId) => {
  const { data, error } = await supabase
    .from('device_tokens')
    .select('token')
    .eq('userId', userId);

  if (error) throw error;
  return data.map(d => d.token);
};

// Delete device token
export const deleteDeviceToken = async (token) => {
  const { error } = await supabase
    .from('device_tokens')
    .delete()
    .eq('token', token);

  if (error) throw error;
};

// Subscription Management Functions

// Get user's subscription info
// Get user's subscription info
export const getUserSubscriptionInfo = async (userId) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('subscription_plan, subscription_status, subscription_plan_type, product_identifier, topics_created_count')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data || { subscription_plan: 'free', subscription_status: 'active', subscription_plan_type: null, product_identifier: null, topics_created_count: 0 };
};

// Increment user's topic creation count
export const incrementTopicCount = async (userId) => {
  // Get current count
  const { data: profileData, error: profileError } = await supabase
    .from('user_profiles')
    .select('topics_created_count')
    .eq('id', userId)
    .single();

  if (profileError) throw profileError;

  const newCount = (profileData.topics_created_count || 0) + 1;

  // Update with new count
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ topics_created_count: newCount })
    .eq('id', userId)
    .select('topics_created_count')
    .single();

  if (error) throw error;
  return data;
};

// Update user's subscription plan
export const updateSubscriptionPlan = async (userId, plan, status = 'active', revenuecatCustomerId = null, productId = null, planType = null, subscriptionSource = null, expiresAt = null) => {
  console.log(`📝 Attempting to update subscription for user: ${userId} to plan: ${plan}, status: ${status}`);
  if (revenuecatCustomerId) {
    console.log(`🔗 Storing RevenueCat/Stripe Customer ID: ${revenuecatCustomerId}`);
  }
  if (productId) {
    console.log(`📦 Storing Product ID: ${productId}`);
  }
  if (planType) {
    console.log(`📅 Storing Plan Type: ${planType}`);
  }
  if (subscriptionSource) {
    console.log(`🔄 Storing Subscription Source: ${subscriptionSource}`);
  }
  if (expiresAt) {
    console.log(`⏰ Storing Expiration Date: ${expiresAt}`);
  }

  // Prepare update data
  const updateData = {
    subscription_plan: plan,
    subscription_status: status,
    updated_at: new Date().toISOString()
  };

  // Add RevenueCat customer ID or Stripe subscription ID if provided
  if (revenuecatCustomerId) {
    updateData.revenuecat_customer_id = revenuecatCustomerId;
  }

  // Add product ID if provided
  if (productId) {
    updateData.product_identifier = productId;
  }

  // Add plan type if provided
  if (planType) {
    updateData.subscription_plan_type = planType;
  }

  // Add subscription source if provided (stripe or revenuecat)
  if (subscriptionSource) {
    updateData.subscription_source = subscriptionSource;
  }

  // Add expiration date if provided
  if (expiresAt) {
    updateData.expires_at = expiresAt;
  }

  // Try to update existing profile
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updateData)
    .eq('id', userId)
    .select()
    .maybeSingle(); // Use maybeSingle to avoid error if not found

  if (error) {
    console.error('❌ Supabase error updating subscription:', error);
    throw error;
  }

  // If profile exists and was updated
  if (data) {
    console.log('✅ Subscription updated successfully for user:', userId, 'New plan:', data.subscription_plan, 'Status:', data.subscription_status, 'Type:', data.subscription_plan_type, 'Source:', data.subscription_source);
    return data;
  }

  // If profile doesn't exist, create it
  console.log(`⚠️ User profile not found for ${userId}, creating new profile...`);

  // 1. Get user details from Auth
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);

  if (userError || !userData.user) {
    console.error('❌ Failed to find user in Auth:', userError);
    throw new Error(`User ${userId} not found in Auth system`);
  }

  const user = userData.user;

  // 2. Create new profile
  const newProfileData = {
    id: userId,
    email: user.email,
    full_name: user.user_metadata?.full_name || '',
    auth_provider: user.app_metadata?.provider || 'email',
    subscription_plan: plan,
    subscription_status: status,
    topics_created_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_login_at: new Date().toISOString()
  };

  // Add RevenueCat customer ID or Stripe subscription ID if provided
  if (revenuecatCustomerId) {
    newProfileData.revenuecat_customer_id = revenuecatCustomerId;
  }

  // Add product ID if provided
  if (productId) {
    newProfileData.product_identifier = productId;
  }

  // Add plan type if provided
  if (planType) {
    newProfileData.subscription_plan_type = planType;
  }

  // Add subscription source if provided
  if (subscriptionSource) {
    newProfileData.subscription_source = subscriptionSource;
  }

  // Add expiration date if provided
  if (expiresAt) {
    newProfileData.expires_at = expiresAt;
  }

  const { data: newProfile, error: createError } = await supabase
    .from('user_profiles')
    .insert(newProfileData)
    .select()
    .single();

  if (createError) {
    console.error('❌ Failed to create user profile:', createError);
    throw createError;
  }

  console.log('✅ Created new profile with subscription for user:', userId);
  return newProfile;
};

// Default export for convenience
export default {
  createTopic,
  getTopicById,
  updateTopicStatus,
  updateProgress,
  updateTopicTitle,
  saveProcessedContent,
  getUserTopics,
  deleteTopic,
  uploadFile,
  getFileUrl,
  downloadFile,
  deleteFile,
  storeDeviceToken,
  getUserDeviceTokens,
  deleteDeviceToken,
  getUserSubscriptionInfo,
  incrementTopicCount,
  updateSubscriptionPlan,
  checkTopicExists
};
