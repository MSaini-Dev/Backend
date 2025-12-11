/**
 * Authentication Middleware
 * JWT token verification for protected routes
 */

const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

// Verify JWT token
const verifyToken = (req, res, next) => {
  let token;

  // Get token from header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Get token from query parameter (for download links)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  // Get token from params (for download routes)
  if (!token && req.params.token) {
    token = req.params.token;
  }

  if (!token) {
    return next(new AppError('Access token is required', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is expired
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      return next(new AppError('Token has expired', 401));
    }

    // Attach decoded data to request
    req.user = decoded;
    req.fileId = decoded.fileId;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token has expired', 401));
    }
    return next(new AppError('Token verification failed', 401));
  }
};

// Optional token verification (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.fileId = decoded.fileId;
  } catch (error) {
    // Continue without authentication
    console.log('Optional auth failed:', error.message);
  }

  next();
};

// Generate download token
const generateDownloadToken = (fileId, expiresIn = '1h') => {
  return jwt.sign(
    { 
      fileId, 
      timestamp: Date.now(),
      type: 'download'
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

// Verify download token specifically
const verifyDownloadToken = (req, res, next) => {
  const { token } = req.params;

  if (!token) {
    return next(new AppError('Download token is required', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify token type
    if (decoded.type !== 'download') {
      return next(new AppError('Invalid token type', 401));
    }

    req.fileId = decoded.fileId;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Download link has expired. Please generate a new one.', 401));
    }
    return next(new AppError('Invalid download token', 401));
  }
};

// Check if token is about to expire
const checkTokenExpiry = (req, res, next) => {
  if (!req.user || !req.user.exp) {
    return next();
  }

  const expiresIn = req.user.exp - Date.now() / 1000;
  
  // If token expires in less than 5 minutes, send warning header
  if (expiresIn < 300) {
    res.setHeader('X-Token-Expiring', 'true');
    res.setHeader('X-Token-Expires-In', Math.floor(expiresIn));
  }

  next();
};

module.exports = {
  verifyToken,
  optionalAuth,
  generateDownloadToken,
  verifyDownloadToken,
  checkTokenExpiry,
};
