import supabase from '../config/supabase.js';
import axios from 'axios';
import supabaseService from '../services/supabaseService.js';

// Helper function to map Supabase errors to user-friendly messages
const mapAuthErrorToUserMessage = (error) => {
  const errorMessage = error.message || '';
  const errorCode = error.code;

  // Check for common Supabase error patterns
  if (errorMessage.includes('User already registered') || errorCode === '23505') {
    return 'This email is already registered. Please log in instead.';
  }

  if (errorMessage.includes('Password should be at least') || errorMessage.includes('password')) {
    return 'Password must be at least 6 characters long.';
  }

  if (errorMessage.includes('Invalid email') || errorMessage.includes('email')) {
    return 'Please enter a valid email address.';
  }

  if (errorMessage.includes('Network') || errorMessage.includes('connection')) {
    return 'Network error. Please check your connection and try again.';
  }

  if (errorMessage.includes('rate limit')) {
    return 'Too many attempts. Please try again in a few minutes.';
  }

  // For database or server errors, provide a generic message
  if (errorCode && errorCode.startsWith('5')) {
    return 'Server error. Please try again later.';
  }

  // Default fallback message
  return 'Unable to create account. Please try again.';
};

// Sign up with email
export const signUpWithEmail = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    console.log('📝 Signup request received for:', email);

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Use admin API to create user with email already confirmed
    // This bypasses email confirmation requirement
    const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName || '',
        auth_provider: 'email'
      }
    });

    if (adminError) throw adminError;

    console.log('✅ User created with admin API:', adminData.user.id);

    // Now sign in the user to get a session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      console.error('❌ Auto-login failed after user creation:', signInError);
      throw new Error('Account created but login failed. Please try logging in manually.');
    }

    console.log('✅ Auto-login successful, session retrieved.');

    console.log('📦 Supabase signup response:', {
      hasUser: !!signInData?.user,
      hasSession: !!signInData?.session,
      userId: signInData?.user?.id,
      sessionKeys: signInData?.session ? Object.keys(signInData.session) : []
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: signInData.user,
      session: signInData.session
    });

  } catch (error) {
    console.error('❌ Sign up error:', error);
    const userFriendlyMessage = mapAuthErrorToUserMessage(error);
    res.status(400).json({ error: userFriendlyMessage });
  }
};

// Sign in with Apple ID Token
export const signInWithApple = async (req, res) => {
  return res.status(400).json({ error: 'Apple Sign-In is currently disabled.' });
};

// Sign in with Google (ID Token Flow)
export const signInWithGoogle = async (req, res) => {
  try {
    const { idToken } = req.body;

    console.log('🤖 ========== GOOGLE SIGN-IN REQUEST ==========');
    console.log('📥 Request body keys:', Object.keys(req.body));
    console.log('🔑 ID Token received:', !!idToken);
    console.log('🔑 ID Token length:', idToken?.length || 0);
    console.log('🔑 ID Token preview:', idToken ? idToken.substring(0, 50) + '...' : 'MISSING');

    if (!idToken) {
      console.error('❌ No ID Token provided in request');
      return res.status(400).json({ error: 'ID Token is required' });
    }

    console.log('📤 Calling Supabase signInWithIdToken...');

    // Sign in with Supabase using the ID token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    console.log('📥 Supabase response:', {
      hasData: !!data,
      hasError: !!error,
      hasUser: !!data?.user,
      hasSession: !!data?.session,
      userId: data?.user?.id,
      userEmail: data?.user?.email,
      errorMessage: error?.message,
      errorStatus: error?.status,
    });

    if (error) {
      console.error('❌ Supabase signInWithIdToken error:', {
        message: error.message,
        status: error.status,
        name: error.name,
      });
      throw error;
    }

    // Check/Create user profile
    if (data.user) {
      console.log('👤 Creating/updating user profile...');
      console.log('User metadata:', data.user.user_metadata);

      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: data.user.id,
          email: data.user.email,
          full_name: data.user.user_metadata?.full_name || '',
          avatar_url: data.user.user_metadata?.avatar_url || '',
          auth_provider: data.user.app_metadata?.provider || 'google',
          updated_at: new Date().toISOString(),
          last_login_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (profileError) {
        console.error('⚠️ Error updating profile (non-fatal):', profileError);
      } else {
        console.log('✅ User profile created/updated successfully');
      }
    }

    console.log('✅ Google Sign-In successful, sending response');
    console.log('📤 Response data:', {
      success: true,
      hasUser: !!data.user,
      hasSession: !!data.session,
      userId: data.user?.id,
    });

    res.json({
      success: true,
      user: data.user,
      session: data.session,
    });

  } catch (error) {
    console.error('❌ ========== GOOGLE SIGN-IN ERROR ==========');
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      status: error.status,
      response: error.response?.data,
      stack: error.stack,
    });

    res.status(400).json({
      error: 'Google Sign-In failed',
      details: error.response?.data || error.message
    });
  }
};

// Sign in with email
export const signInWithEmail = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password required'
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Update last login
    await supabase
      .from('user_profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.user.id);

    res.json({
      success: true,
      user: data.user,
      session: data.session
    });

  } catch (error) {
    console.error('Sign in error:', error);
    res.status(400).json({ error: error.message });
  }
};

// Sign in with OAuth (Google/Apple) - generates auth URL
export const signInWithOAuth = async (req, res) => {
  return res.status(400).json({ error: 'OAuth is currently disabled.' });
};

// Handle OAuth callback
export const handleOAuthCallback = async (req, res) => {
  return res.status(400).json({ error: 'OAuth is currently disabled.' });
};

// Sign out
export const signOut = async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Signed out successfully'
    });

  } catch (error) {
    console.error('Sign out error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get current user profile
// Get current user profile
export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user profile (might not exist yet)
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle(); // ← Changed from .single() to .maybeSingle()

    // If profile doesn't exist, create it
    if (!profile) {
      console.log('Profile not found, creating...');

      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          email: req.user.email,
          full_name: req.user.user_metadata?.full_name || '',
          auth_provider: req.user.app_metadata?.provider || 'email',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Create profile error:', createError);
        // If creation fails, just return user without profile
        return res.json({
          success: true,
          user: req.user,
          profile: null,
          message: 'Profile will be created automatically'
        });
      }

      return res.json({
        success: true,
        user: req.user,
        profile: newProfile
      });
    }

    if (error) {
      console.error('Get profile error:', error);
      // Return user even if profile fails
      return res.json({
        success: true,
        user: req.user,
        profile: null
      });
    }

    // Get subscription info
    const subscriptionInfo = await supabaseService.getUserSubscriptionInfo(userId);

    // Enrich profile with subscription data
    const enrichedProfile = {
      ...profile,
      subscription_plan: subscriptionInfo.subscription_plan,
      subscription_status: subscriptionInfo.subscription_status,
      subscription_plan_type: subscriptionInfo.subscription_plan_type,
      topics_created_count: subscriptionInfo.topics_created_count,
      topics_limit: subscriptionInfo.subscription_plan === 'free' ? 2 : null
    };

    res.json({
      success: true,
      user: req.user,
      profile: enrichedProfile
    });

  } catch (error) {
    console.error('Get current user error:', error);
    // Always return user even if profile fails
    res.json({
      success: true,
      user: req.user,
      profile: null,
      error: error.message
    });
  }
};

// Update user profile
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      fullName,
      avatarUrl,
      preferredDifficulty,
      notificationEnabled,
      theme
    } = req.body;

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (fullName !== undefined) updates.full_name = fullName;
    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
    if (preferredDifficulty !== undefined) updates.preferred_difficulty = preferredDifficulty;
    if (notificationEnabled !== undefined) updates.notification_enabled = notificationEnabled;
    if (theme !== undefined) updates.theme = theme;

    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile: data
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete account
export const deleteAccount = async (req, res) => {
  console.log('🔴 DELETE ACCOUNT ENDPOINT CALLED');
  console.log('User ID:', req.user?.id);

  try {
    const userId = req.user.id;

    console.log(`Starting account deletion for user: ${userId}`);

    // Step 1: Delete all topics (this will cascade delete flashcards, quizzes, summaries, mind maps)
    const { error: topicsError } = await supabase
      .from('topics')
      .delete()
      .eq('userId', userId);

    if (topicsError) {
      console.error('Error deleting topics:', topicsError);
      throw new Error('Failed to delete user topics');
    }

    console.log('Topics deleted successfully');

    // Step 2: Delete user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Error deleting profile:', profileError);
      throw new Error('Failed to delete user profile');
    }

    console.log('User profile deleted successfully');

    // Step 3: Delete the auth user (this is the final step)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Error deleting auth user:', authError);
      throw new Error('Failed to delete authentication account');
    }

    console.log('Auth user deleted successfully');

    res.json({
      success: true,
      message: 'Account and all associated data deleted successfully'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      error: error.message || 'Failed to delete account',
      details: 'Please contact support if the problem persists'
    });
  }
};

// Refresh token
export const refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token
    });

    if (error) throw error;

    res.json({
      success: true,
      session: data.session
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(400).json({ error: error.message });
  }
};