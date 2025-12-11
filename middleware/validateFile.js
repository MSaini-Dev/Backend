/**
 * File Validation Middleware
 * Validates uploaded files before processing
 */

const path = require('path');
const { AppError } = require('./errorHandler');

// File type validation
const allowedMimeTypes = {
  pdf: ['application/pdf'],
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
  document: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'application/vnd.oasis.opendocument.text', // .odt
  ],
};

const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.doc', '.docx', '.odt'];

// Validate file type
const validateFileType = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }

  const files = req.files || [req.file];
  const allowedTypes = process.env.ALLOWED_EXTENSIONS.split(',').map(ext => `.${ext}`);

  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (!allowedTypes.includes(ext)) {
      return next(
        new AppError(
          `Invalid file type. Only ${allowedTypes.join(', ')} files are allowed.`,
          400
        )
      );
    }

    // Validate MIME type
    const isValidMimeType = Object.values(allowedMimeTypes).some(types =>
      types.includes(file.mimetype)
    );

    if (!isValidMimeType) {
      return next(new AppError('Invalid file MIME type.', 400));
    }
  }

  next();
};

// Validate file size
const validateFileSize = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }

  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 52428800; // 50MB default
  const files = req.files || [req.file];

  for (const file of files) {
    if (file.size > maxSize) {
      return next(
        new AppError(
          `File size exceeds maximum limit of ${maxSize / 1024 / 1024}MB`,
          400
        )
      );
    }

    // Minimum size check (avoid empty files)
    if (file.size < 100) {
      return next(new AppError('File is too small or empty', 400));
    }
  }

  next();
};

// Validate PDF file specifically
const validatePDF = (req, res, next) => {
  if (!req.file && !req.files) {
    return next(new AppError('No PDF file uploaded', 400));
  }

  const files = req.files || [req.file];

  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (ext !== '.pdf') {
      return next(new AppError('Only PDF files are allowed for this operation', 400));
    }

    if (!file.mimetype.includes('pdf')) {
      return next(new AppError('Invalid PDF file', 400));
    }
  }

  next();
};

// Validate image file
const validateImage = (req, res, next) => {
  if (!req.file && !req.files) {
    return next(new AppError('No image file uploaded', 400));
  }

  const files = req.files || [req.file];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif'];

  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (!imageExtensions.includes(ext)) {
      return next(new AppError('Only image files (JPG, PNG, GIF) are allowed', 400));
    }

    if (!file.mimetype.startsWith('image/')) {
      return next(new AppError('Invalid image file', 400));
    }
  }

  next();
};

// Sanitize filename
const sanitizeFilename = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }

  const files = req.files || [req.file];

  for (const file of files) {
    // Remove potentially dangerous characters
    const sanitized = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();

    file.originalname = sanitized;
  }

  next();
};

// Check file existence
const checkFileExists = (fileId) => {
  return async (req, res, next) => {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const uploadDir = process.env.UPLOAD_DIR;
      const files = await fs.readdir(uploadDir);
      const fileExists = files.some(f => f.startsWith(fileId));

      if (!fileExists) {
        return next(new AppError('File not found or has expired', 404));
      }

      next();
    } catch (error) {
      next(new AppError('Error checking file existence', 500));
    }
  };
};

// Validate file count for merge operation
const validateMergeFiles = (req, res, next) => {
  if (!req.files || !Array.isArray(req.files)) {
    return next(new AppError('Please upload at least 2 PDF files to merge', 400));
  }

  if (req.files.length < 2) {
    return next(new AppError('At least 2 PDF files are required for merging', 400));
  }

  if (req.files.length > 10) {
    return next(new AppError('Maximum 10 files can be merged at once', 400));
  }

  next();
};

// Validate request body for file operations
const validateFileOperation = (req, res, next) => {
  const { fileId } = req.body;

  if (!fileId) {
    return next(new AppError('File ID is required', 400));
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(fileId)) {
    return next(new AppError('Invalid file ID format', 400));
  }

  next();
};

module.exports = {
  validateFileType,
  validateFileSize,
  validatePDF,
  validateImage,
  sanitizeFilename,
  checkFileExists,
  validateMergeFiles,
  validateFileOperation,
};
