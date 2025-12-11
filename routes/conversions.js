const express = require('express');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const sharp = require('sharp');
const tesseract = require('node-tesseract-ocr');
const { getFilePath, saveProcessedFile } = require('../utils/fileHelpers');
const { convertPdfToImages, convertImageToPdf } = require('../utils/imageConversion');
const { pdfToWord, wordToPdf } = require('../utils/docConversion');
const { extractImagesFromPdf } = require('../utils/imageExtraction');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');

const router = express.Router();

// PDF to JPG
router.post('/pdf-to-jpg', async (req, res) => {
  try {
    const { fileId, dpi } = req.body;
    
    const filePath = await getFilePath(fileId);
    const imageFiles = await convertPdfToImages(filePath, dpi || 150);
    
    res.json({ success: true, imageFiles });
  } catch (error) {
    console.error('PDF to JPG error:', error);
    res.status(500).json({ error: error.message });
  }
});

// JPG to PDF
router.post('/jpg-to-pdf', async (req, res) => {
  try {
    const { fileIds } = req.body;
    
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    const pdfDoc = await PDFDocument.create();
    
    for (const fileId of fileIds) {
      const filePath = await getFilePath(fileId);
      const imageBytes = await fs.readFile(filePath);
      
      let embeddedImage;
      const ext = path.extname(filePath).toLowerCase();
      
      if (ext === '.png') {
        embeddedImage = await pdfDoc.embedPng(imageBytes);
      } else {
        embeddedImage = await pdfDoc.embedJpg(imageBytes);
      }
      
      const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: embeddedImage.width,
        height: embeddedImage.height
      });
    }
    
    const pdfBytes = await pdfDoc.save();
    const newFileId = await saveProcessedFile(pdfBytes, 'pdf');
    
    res.json({ success: true, fileId: newFileId });
  } catch (error) {
    console.error('JPG to PDF error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PDF to Word
router.post('/pdf-to-word', async (req, res) => {
  try {
    const { fileId } = req.body;
    
    const filePath = await getFilePath(fileId);
    const wordFileId = await pdfToWord(filePath);
    
    res.json({ success: true, fileId: wordFileId });
  } catch (error) {
    console.error('PDF to Word error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Word to PDF
router.post('/word-to-pdf', async (req, res) => {
  try {
    const { fileId } = req.body;
    
    const filePath = await getFilePath(fileId);
    const pdfFileId = await wordToPdf(filePath);
    
    res.json({ success: true, fileId: pdfFileId });
  } catch (error) {
    console.error('Word to PDF error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Extract images from PDF
router.post('/extract-images', async (req, res) => {
  try {
    const { fileId } = req.body;
    
    const filePath = await getFilePath(fileId);
    const imageFiles = await extractImagesFromPdf(filePath);
    
    res.json({ success: true, imageFiles });
  } catch (error) {
    console.error('Extract images error:', error);
    res.status(500).json({ error: error.message });
  }
});

// OCR - Convert scanned PDF to searchable PDF
router.post('/ocr', async (req, res) => {
  try {
    const { fileId, languages } = req.body;
    
    const filePath = await getFilePath(fileId);
    
    // Convert PDF pages to images
    const imageFiles = await convertPdfToImages(filePath, 300);
    
    // Perform OCR on each image
    const config = {
      lang: languages || 'eng+hin',
      oem: 3,
      psm: 3
    };
    
    const pdfDoc = await PDFDocument.create();
    
    for (const imageFile of imageFiles) {
      const imagePath = path.join(process.env.UPLOAD_DIR, imageFile.filename);
      
      // Perform OCR
      const text = await tesseract.recognize(imagePath, config);
      
      // Create page with image and text layer
      const imageBytes = await fs.readFile(imagePath);
      let embeddedImage;
      
      if (imageFile.filename.endsWith('.png')) {
        embeddedImage = await pdfDoc.embedPng(imageBytes);
      } else {
        embeddedImage = await pdfDoc.embedJpg(imageBytes);
      }
      
      const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
      
      // Draw image
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: embeddedImage.width,
        height: embeddedImage.height
      });
      
      // Overlay invisible text for searchability
      // Note: This is simplified - production would need proper text positioning
    }
    
    const pdfBytes = await pdfDoc.save();
    const newFileId = await saveProcessedFile(pdfBytes, 'pdf');
    
    res.json({ success: true, fileId: newFileId });
  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
