import supabase from '../config/supabase.js';

export const authenticateUser = async (req, res, next) => {
  console.log('🔵 AUTH MIDDLEWARE CALLED for:', req.method, req.path);

  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    console.log('Auth header:', authHeader ? 'Present' : 'Missing');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    console.log('Token:', token.substring(0, 20) + '...');

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.log('❌ Invalid token:', error?.message);
      return res.status(401).json({ error: 'Invalid token' });
    }

    console.log('✅ User authenticated:', user.id);

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Optional: Admin check
export const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Query user metadata or admin table
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('userId', userId)
      .single();

    if (error || data?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Authorization failed' });
  }
};