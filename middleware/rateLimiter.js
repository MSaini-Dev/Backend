/**
 * Advanced Rate Limiting Middleware
 * Prevents abuse and ensures fair usage
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

// Upload rate limiter - more restrictive
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: 'Upload limit exceeded. Please try again later.',
  skipSuccessfulRequests: false,
  skipFailedRequests: true,
});

// Conversion rate limiter
const conversionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 conversions per hour
  message: 'Conversion limit exceeded. Please try again later.',
});

// Download rate limiter
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 downloads per 15 minutes
  message: 'Download limit exceeded. Please try again later.',
  skipFailedRequests: true,
});

// Strict limiter for expensive operations
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: 'You have exceeded the limit for this operation.',
});

// Dynamic rate limiter based on file size
const dynamicLimiter = (maxSize) => {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    max: (req) => {
      const fileSize = req.file?.size || req.body?.fileSize || 0;
      
      // Smaller files get higher limits
      if (fileSize < 1024 * 1024) { // < 1MB
        return 50;
      } else if (fileSize < 10 * 1024 * 1024) { // < 10MB
        return 30;
      } else {
        return 10;
      }
    },
    message: 'Rate limit exceeded based on file size.',
  });
};

// IP-based blocking for suspicious activity
const suspiciousActivityTracker = new Map();

const checkSuspiciousActivity = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!suspiciousActivityTracker.has(ip)) {
    suspiciousActivityTracker.set(ip, {
      failedAttempts: 0,
      lastAttempt: now,
      blocked: false,
      blockUntil: null,
    });
  }

  const tracker = suspiciousActivityTracker.get(ip);

  // Check if IP is blocked
  if (tracker.blocked && tracker.blockUntil > now) {
    const remainingTime = Math.ceil((tracker.blockUntil - now) / 1000 / 60);
    return res.status(403).json({
      error: 'Access temporarily blocked',
      message: `Your IP has been temporarily blocked due to suspicious activity. Try again in ${remainingTime} minutes.`,
    });
  }

  // Reset block if time has passed
  if (tracker.blocked && tracker.blockUntil <= now) {
    tracker.blocked = false;
    tracker.failedAttempts = 0;
  }

  next();
};

// Track failed requests
const trackFailedRequest = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function (data) {
    if (res.statusCode >= 400) {
      const ip = req.ip || req.connection.remoteAddress;
      const tracker = suspiciousActivityTracker.get(ip);
      
      if (tracker) {
        tracker.failedAttempts++;
        tracker.lastAttempt = Date.now();

        // Block after 10 failed attempts in 10 minutes
        if (tracker.failedAttempts >= 10) {
          tracker.blocked = true;
          tracker.blockUntil = Date.now() + 30 * 60 * 1000; // Block for 30 minutes
          console.log(`IP ${ip} blocked due to suspicious activity`);
        }
      }
    }
    
    originalSend.call(this, data);
  };

  next();
};

// Clean up old tracking data periodically
setInterval(() => {
  const now = Date.now();
  const timeout = 60 * 60 * 1000; // 1 hour

  for (const [ip, tracker] of suspiciousActivityTracker.entries()) {
    if (!tracker.blocked && now - tracker.lastAttempt > timeout) {
      suspiciousActivityTracker.delete(ip);
    }
  }
}, 15 * 60 * 1000); // Clean up every 15 minutes

module.exports = {
  generalLimiter,
  uploadLimiter,
  conversionLimiter,
  downloadLimiter,
  strictLimiter,
  dynamicLimiter,
  checkSuspiciousActivity,
  trackFailedRequest,
};
