const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const fileId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${fileId}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedExtensions = process.env.ALLOWED_EXTENSIONS.split(',');
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE)
  }
});

// Upload single file
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileId = path.parse(req.file.filename).name;
    const filePath = req.file.path;
    const originalName = req.file.originalname;

    // Create metadata
    const metadata = {
      fileId,
      originalName,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + parseInt(process.env.FILE_RETENTION_MINUTES) * 60000).toISOString()
    };

    // Save metadata
    const metadataPath = path.join(process.env.UPLOAD_DIR, `${fileId}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    res.json({
      success: true,
      fileId,
      filename: req.file.filename,
      originalName,
      size: req.file.size
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload multiple files (for merge)
router.post('/multiple', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const filesData = req.files.map(file => {
      const fileId = path.parse(file.filename).name;
      
      // Create metadata for each file
      const metadata = {
        fileId,
        originalName: file.originalname,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + parseInt(process.env.FILE_RETENTION_MINUTES) * 60000).toISOString()
      };

      const metadataPath = path.join(process.env.UPLOAD_DIR, `${fileId}.json`);
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      return {
        fileId,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size
      };
    });

    res.json({
      success: true,
      files: filesData
    });
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
