const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Preview PDF without token (for editor view)
router.get('/download-preview/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Find file
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const files = fs.readdirSync(uploadDir);
    const targetFile = files.find(f => f.startsWith(fileId) && !f.endsWith('.json'));
    
    if (!targetFile) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const filePath = path.join(uploadDir, targetFile);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download file with token
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired download token' });
    }

    const { fileId } = decoded;

    // Find file
    const uploadDir = process.env.UPLOAD_DIR;
    const files = fs.readdirSync(uploadDir);
    const targetFile = files.find(f => f.startsWith(fileId) && !f.endsWith('.json'));

    if (!targetFile) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(uploadDir, targetFile);

    // Get metadata for original filename
    const metadataPath = path.join(uploadDir, `${fileId}.json`);
    let originalName = targetFile;

    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      originalName = metadata.originalName || targetFile;
    }

    // Set headers and send file
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
