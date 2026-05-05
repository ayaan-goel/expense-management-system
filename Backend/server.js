const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import middleware
const { upload } = require('./middleware/fileUpload');
const { authenticateToken } = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const approvalRoutes = require('./routes/approvals');
const adminRoutes = require('./routes/admin');
const ocrRoutes = require('./routes/ocr');

// Initialize database
require('./models/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// File upload middleware
app.use(upload);

// Logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/expenses', authenticateToken, expenseRoutes);
app.use('/approval', authenticateToken, approvalRoutes);
app.use('/admin', authenticateToken, adminRoutes);
app.use('/ocr', authenticateToken, ocrRoutes);

// Serve static files for uploaded receipts (with authentication)
app.use('/uploads', authenticateToken, express.static('uploads'));

// API documentation endpoint
app.get('/api-docs', (req, res) => {
  res.json({
    title: 'Expense Tracker API',
    version: '1.0.0',
    description: 'API for expense management with approval workflows',
    endpoints: {
      auth: {
        'POST /auth/signup': 'Create new account (first user becomes admin)',
        'POST /auth/login': 'User login',
        'GET /auth/me': 'Get current user info',
        'PUT /auth/password': 'Change password'
      },
      expenses: {
        'GET /expenses': 'List expenses with pagination',
        'GET /expenses/:id': 'Get expense details',
        'POST /expenses': 'Create new expense',
        'PUT /expenses/:id': 'Update expense (draft only)',
        'POST /expenses/:id/submit': 'Submit expense for approval',
        'GET /expenses/my': 'Get current user expenses',
        'GET /expenses/pending': 'Get pending approvals (managers)'
      },
      approval: {
        'POST /approval/:requestId/approve': 'Approve expense',
        'POST /approval/:requestId/reject': 'Reject expense',
        'POST /approval/:requestId/escalate': 'Escalate expense'
      },
      admin: {
        'GET /admin/users': 'List all users',
        'POST /admin/users': 'Create new user',
        'PUT /admin/users/:id': 'Update user',
        'DELETE /admin/users/:id': 'Delete user',
        'GET /admin/rules': 'List approval rules',
        'POST /admin/rules': 'Create approval rule',
        'POST /admin/sequences': 'Create approval sequence',
        'POST /admin/expenses/:id/override': 'Admin override expense'
      },
      ocr: {
        'POST /ocr/parse': 'Parse receipt using OCR'
      }
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);

  // Handle specific error types
  if (error.type === 'entity.too.large') {
    return res.status(400).json({ error: 'Request payload too large' });
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large' });
  }

  // Default error response
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📝 API Documentation available at http://localhost:${PORT}/api-docs`);
  console.log(`🏥 Health check available at http://localhost:${PORT}/health`);
  console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;