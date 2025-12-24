import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import topicRoutes from './routes/topicRoutes.js';
import youtubeRoutes from './routes/youtubeRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import folderRoutes from './routes/folderRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import userRoutes from './routes/userRoutes.js';
import stripeRoutes from './routes/stripeRoutes.js';

dotenv.config();

const app = express();

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:8081',
  'https://tikonote.app',
  'https://www.tikonote.app',
  'https://tikonote-backend.onrender.com',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Debug log to see incoming origin
    console.log('Request Origin:', origin);

    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // In development, simply reflect the origin back
    // This fixes issues with ngrok, local IPs, etc. where strict checking fails
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      return callback(null, true);
    }

    // Production checks
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Creating regex for dynamic subdomains in production
    const isNgrok = origin.includes('.ngrok-free.app') || origin.includes('.ngrok.io');
    const isRender = origin.includes('.onrender.com');

    if (isNgrok || isRender) {
      return callback(null, true);
    }

    console.log('Blocked by CORS:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning', 'x-custom-header'],
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

// Middleware
app.use(cors(corsOptions));

// Stripe webhook needs raw body for signature verification
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// Regular JSON parsing for other routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/webhooks', webhookRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/youtube/', youtubeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/users', userRoutes);
app.use('/api', topicRoutes);



// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
