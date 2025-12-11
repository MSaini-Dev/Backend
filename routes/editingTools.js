const express = require('express');
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { getFilePath, saveProcessedFile } = require('../utils/fileHelpers');

const router = express.Router();

// Add text to PDF
router.post('/add-text', async (req, res) => {
  try {
    const { fileId, texts } = req.body;
    
    if (!fileId || !Array.isArray(texts)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const filePath = await getFilePath(fileId);
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Embed fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Add text to specified pages
    for (const textItem of texts) {
      const { pageIndex, text, x, y, size, color, bold, rotation } = textItem;
      const page = pdfDoc.getPage(pageIndex);
      const font = bold ? helveticaBold : helveticaFont;
      
      const textColor = color ? 
        rgb(color.r / 255, color.g / 255, color.b / 255) : 
        rgb(0, 0, 0);
      
      page.drawText(text, {
        x: x || 50,
        y: y || 50,
        size: size || 12,
        font,
        color: textColor,
        rotate: rotation ? degrees(rotation) : undefined
      });
    }
    
    const modifiedPdfBytes = await pdfDoc.save();
    const newFileId = await saveProcessedFile(modifiedPdfBytes, 'pdf');
    
    res.json({ success: true, fileId: newFileId });
  } catch (error) {
    console.error('Add text error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Edit existing text (simplified - removes and replaces)
router.post('/edit-text', async (req, res) => {
  try {
    const { fileId, edits } = req.body;
    
    // Note: Editing existing text in PDFs is complex
    // This implementation overlays new text over old positions
    const filePath = await getFilePath(fileId);
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    for (const edit of edits) {
      const { pageIndex, x, y, text, size, color } = edit;
      const page = pdfDoc.getPage(pageIndex);
      
      // Draw white rectangle to cover old text
      page.drawRectangle({
        x: x - 5,
        y: y - 5,
        width: font.widthOfTextAtSize(text, size) + 10,
        height: size + 10,
        color: rgb(1, 1, 1)
      });
      
      // Draw new text
      page.drawText(text, {
        x,
        y,
        size,
        font,
        color: rgb(color.r / 255, color.g / 255, color.b / 255)
      });
    }
    
    const modifiedPdfBytes = await pdfDoc.save();
    const newFileId = await saveProcessedFile(modifiedPdfBytes, 'pdf');
    
    res.json({ success: true, fileId: newFileId });
  } catch (error) {
    console.error('Edit text error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove text (cover with white rectangle)
router.post('/remove-text', async (req, res) => {
  try {
    const { fileId, regions } = req.body;
    
    const filePath = await getFilePath(fileId);
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    for (const region of regions) {
      const { pageIndex, x, y, width, height } = region;
      const page = pdfDoc.getPage(pageIndex);
      
      page.drawRectangle({
        x,
        y,
        width,
        height,
        color: rgb(1, 1, 1)
      });
    }
    
    const modifiedPdfBytes = await pdfDoc.save();
    const newFileId = await saveProcessedFile(modifiedPdfBytes, 'pdf');
    
    res.json({ success: true, fileId: newFileId });
  } catch (error) {
    console.error('Remove text error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add image to PDF
router.post('/add-image', async (req, res) => {
  try {
    const { fileId, images } = req.body;
    
    const filePath = await getFilePath(fileId);
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    for (const imageItem of images) {
      const { pageIndex, imageData, x, y, width, height, opacity } = imageItem;
      const page = pdfDoc.getPage(pageIndex);
      
      // Decode base64 image
      const imageBytes = Buffer.from(imageData.split(',')[1], 'base64');
      
      let embeddedImage;
      if (imageData.includes('image/png')) {
        embeddedImage = await pdfDoc.embedPng(imageBytes);
      } else {
        embeddedImage = await pdfDoc.embedJpg(imageBytes);
      }
      
      page.drawImage(embeddedImage, {
        x,
        y,
        width,
        height,
        opacity: opacity || 1
      });
    }
    
    const modifiedPdfBytes = await pdfDoc.save();
    const newFileId = await saveProcessedFile(modifiedPdfBytes, 'pdf');
    
    res.json({ success: true, fileId: newFileId });
  } catch (error) {
    console.error('Add image error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add watermark
router.post('/watermark', async (req, res) => {
  try {
    const { fileId, watermark } = req.body;
    
    const filePath = await getFilePath(fileId);
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    for (const page of pages) {
      const { width, height } = page.getSize();
      
      if (watermark.type === 'text') {
        const textWidth = font.widthOfTextAtSize(watermark.text, watermark.size || 48);
        const textHeight = watermark.size || 48;
        
        page.drawText(watermark.text, {
          x: watermark.position === 'center' ? (width - textWidth) / 2 : 50,
          y: watermark.position === 'center' ? height / 2 : 50,
          size: watermark.size || 48,
          font,
          color: rgb(0.7, 0.7, 0.7),
          opacity: watermark.opacity || 0.3,
          rotate: watermark.diagonal ? degrees(45) : degrees(0)
        });
      } else if (watermark.type === 'image') {
        // Handle image watermark
        const imageBytes = Buffer.from(watermark.imageData.split(',')[1], 'base64');
        const embeddedImage = watermark.imageData.includes('image/png') ?
          await pdfDoc.embedPng(imageBytes) :
          await pdfDoc.embedJpg(imageBytes);
        
        const imgDims = embeddedImage.scale(0.5);
        
        page.drawImage(embeddedImage, {
          x: (width - imgDims.width) / 2,
          y: (height - imgDims.height) / 2,
          width: imgDims.width,
          height: imgDims.height,
          opacity: watermark.opacity || 0.3
        });
      }
    }
    
    const modifiedPdfBytes = await pdfDoc.save();
    const newFileId = await saveProcessedFile(modifiedPdfBytes, 'pdf');
    
    res.json({ success: true, fileId: newFileId });
  } catch (error) {
    console.error('Watermark error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add signature
router.post('/signature', async (req, res) => {
  try {
    const { fileId, signature } = req.body;
    
    const filePath = await getFilePath(fileId);
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    const page = pdfDoc.getPage(signature.pageIndex);
    
    if (signature.type === 'image' || signature.type === 'drawn') {
      const imageBytes = Buffer.from(signature.imageData.split(',')[1], 'base64');
      const embeddedImage = await pdfDoc.embedPng(imageBytes);
      
      page.drawImage(embeddedImage, {
        x: signature.x,
        y: signature.y,
        width: signature.width,
        height: signature.height
      });
    } else if (signature.type === 'typed') {
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
      
      page.drawText(signature.text, {
        x: signature.x,
        y: signature.y,
        size: signature.size || 24,
        font,
        color: rgb(0, 0, 0)
      });
    }
    
    const modifiedPdfBytes = await pdfDoc.save();
    const newFileId = await saveProcessedFile(modifiedPdfBytes, 'pdf');
    
    res.json({ success: true, fileId: newFileId });
  } catch (error) {
    console.error('Signature error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Highlight text
router.post('/highlight', async (req, res) => {
  try {
    const { fileId, highlights } = req.body;
    
    const filePath = await getFilePath(fileId);
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    for (const highlight of highlights) {
      const { pageIndex, x, y, width, height, color } = highlight;
      const page = pdfDoc.getPage(pageIndex);
      
      const highlightColor = color || { r: 255, g: 255, b: 0 };
      
      page.drawRectangle({
        x,
        y,
        width,
        height,
        color: rgb(highlightColor.r / 255, highlightColor.g / 255, highlightColor.b / 255),
        opacity: 0.3
      });
    }
    
    const modifiedPdfBytes = await pdfDoc.save();
    const newFileId = await saveProcessedFile(modifiedPdfBytes, 'pdf');
    
    res.json({ success: true, fileId: newFileId });
  } catch (error) {
    console.error('Highlight error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Draw on PDF (freehand)
router.post('/draw', async (req, res) => {
  try {
    const { fileId, drawings } = req.body;
    
    const filePath = await getFilePath(fileId);
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    for (const drawing of drawings) {
      const { pageIndex, paths, color, thickness } = drawing;
      const page = pdfDoc.getPage(pageIndex);
      
      const drawColor = rgb(color.r / 255, color.g / 255, color.b / 255);
      
      // Draw paths as series of small circles
      for (const path of paths) {
        for (const point of path) {
          page.drawCircle({
            x: point.x,
            y: point.y,
            size: thickness / 2,
            color: drawColor
          });
        }
      }
    }
    
    const modifiedPdfBytes = await pdfDoc.save();
    const newFileId = await saveProcessedFile(modifiedPdfBytes, 'pdf');
    
    res.json({ success: true, fileId: newFileId });
  } catch (error) {
    console.error('Draw error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
