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
export const getUserTopics = async (userId, limit = 20, filter = 'recent') => {
  console.log(`📊 Getting topics for user ${userId} with filter: ${filter}`);

  let query = supabase
    .from('topics')
    .select('*')
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

  const { data, error } = await query
    .order('createdAt', { ascending: false })
    .limit(limit);

  if (error) throw error;

  console.log(`✅ Found ${data.length} topics`);
  return data;
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
export const getUserSubscriptionInfo = async (userId) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('subscription_plan, topics_created_count')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data || { subscription_plan: 'free', topics_created_count: 0 };
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
export const updateSubscriptionPlan = async (userId, plan) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ subscription_plan: plan })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
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
  updateSubscriptionPlan
};
