const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

// Load environment variables
dotenv.config();

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');
const { 
  generalLimiter, 
  checkSuspiciousActivity, 
  trackFailedRequest 
} = require('./middleware/rateLimiter');

// Import routes
const uploadRoute = require('./routes/upload');
const pageToolsRoutes = require('./routes/pageTools');
const editingToolsRoutes = require('./routes/editingTools');
const conversionRoutes = require('./routes/conversions');
const documentToolsRoutes = require('./routes/documentTools');
const downloadRoute = require('./routes/download');
const unlockRoute = require('./routes/unlock');

// Import cleanup utility
const { cleanupOldFiles } = require('./utils/cleanup');

const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN }));

// Request logging
app.use(requestLogger);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting and security
app.use(checkSuspiciousActivity);
app.use(trackFailedRequest);
app.use('/api/', generalLimiter);

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Routes
app.use('/api/upload', uploadRoute);
app.use('/api', pageToolsRoutes);
app.use('/api', editingToolsRoutes);
app.use('/api', conversionRoutes);
app.use('/api', documentToolsRoutes);
app.use('/api/unlock', unlockRoute);
app.use('/api/download', downloadRoute);

// 404 handler
app.use(notFound);

// Error handling middleware (must be last)
app.use(errorHandler);

// Cleanup cron job - runs every 15 minutes
cron.schedule('*/15 * * * *', () => {
  console.log('Running cleanup job...');
  cleanupOldFiles();
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 PDF Suite Backend running on port ${PORT}`);
  console.log(`📁 Upload directory: ${uploadDir}`);
  console.log(`🧹 Cleanup interval: Every 15 minutes`);
  console.log(`⏱️  File retention: ${process.env.FILE_RETENTION_MINUTES} minutes`);
  console.log(`🔒 Security: Helmet, CORS, Rate Limiting enabled`);
});

module.exports = app;
