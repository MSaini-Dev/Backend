const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Unlock download after watching rewarded ad
router.post('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { adWatched } = req.body;
    
    if (!adWatched) {
      return res.status(400).json({ error: 'Ad must be watched to unlock download' });
    }
    
    // Verify file exists
    const uploadDir = process.env.UPLOAD_DIR;
    const files = await fs.readdir(uploadDir);
    const fileExists = files.some(f => f.startsWith(fileId));
    
    if (!fileExists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Generate JWT token for download
    const token = jwt.sign(
      { fileId, timestamp: Date.now() },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    res.json({ 
      success: true, 
      token,
      message: 'Download unlocked'
    });
  } catch (error) {
    console.error('Unlock error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
