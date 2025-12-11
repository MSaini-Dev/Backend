const express = require('express');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getFilePath, saveProcessedFile } = require('../utils/fileHelpers');

const router = express.Router();

// Remove pages
router.post('/remove-pages', async (req, res) => {
  try {
    const { fileId, pagesToRemove } = req.body;
    
    if (!fileId || !Array.isArray(pagesToRemove)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const filePath = await getFilePath(fileId);
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    const totalPages = pdfDoc.getPageCount();
    const newPdf = await PDFDocument.create();
    
    // Copy pages that are not in the remove list
    for (let i = 0; i < totalPages; i++) {
      if (!pagesToRemove.includes(i)) {
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
        newPdf.addPage(copiedPage);
      }
    }
    
    const modifiedPdfBytes = await newPdf.save();
    const newFileId = await saveProcessedFile(modifiedPdfBytes, 'pdf');
    
    res.json({ success: true, fileId: newFileId });
  } catch (error) {
    console.error('Remove pages error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rearrange pages
router.post('/rearrange-pages', async (req, res) => {
  try {
    const { fileId, pageOrder } = req.body;
    
    if (!fileId || !Array.isArray(pageOrder)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const filePath = await getFilePath(fileId);
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    const newPdf = await PDFDocument.create();
    
    // Copy pages in the new order
    for (const pageIndex of pageOrder) {
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIndex]);
      newPdf.addPage(copiedPage);
    }
    
    const modifiedPdfBytes = await newPdf.save();
    const newFileId = await saveProcessedFile(modifiedPdfBytes, 'pdf');
    
    res.json({ success: true, fileId: newFileId });
  } catch (error) {
    console.error('Rearrange pages error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rotate pages
router.post('/rotate-pages', async (req, res) => {
  try {
    const { fileId, rotations } = req.body;
    
    if (!fileId || !rotations) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const filePath = await getFilePath(fileId);
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Apply rotations
    Object.entries(rotations).forEach(([pageIndex, degrees]) => {
      const page = pdfDoc.getPage(parseInt(pageIndex));
      const currentRotation = page.getRotation().angle;
      page.setRotation({ type: 'degrees', angle: currentRotation + degrees });
    });
    
    const modifiedPdfBytes = await pdfDoc.save();
    const newFileId = await saveProcessedFile(modifiedPdfBytes, 'pdf');
    
    res.json({ success: true, fileId: newFileId });
  } catch (error) {
    console.error('Rotate pages error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Extract pages
router.post('/extract-pages', async (req, res) => {
  try {
    const { fileId, pagesToExtract } = req.body;
    
    if (!fileId || !Array.isArray(pagesToExtract)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const filePath = await getFilePath(fileId);
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    const newPdf = await PDFDocument.create();
    
    // Copy only selected pages
    const copiedPages = await newPdf.copyPages(pdfDoc, pagesToExtract);
    copiedPages.forEach(page => newPdf.addPage(page));
    
    const extractedPdfBytes = await newPdf.save();
    const newFileId = await saveProcessedFile(extractedPdfBytes, 'pdf');
    
    res.json({ success: true, fileId: newFileId });
  } catch (error) {
    console.error('Extract pages error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Replace pages
router.post('/replace-pages', async (req, res) => {
  try {
    const { originalFileId, replacementFileId, pageToReplace, replacementPage } = req.body;
    
    if (!originalFileId || !replacementFileId) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const originalPath = await getFilePath(originalFileId);
    const replacementPath = await getFilePath(replacementFileId);
    
    const originalBytes = await fs.readFile(originalPath);
    const replacementBytes = await fs.readFile(replacementPath);
    
    const originalPdf = await PDFDocument.load(originalBytes);
    const replacementPdf = await PDFDocument.load(replacementBytes);
    
    const newPdf = await PDFDocument.create();
    
    const totalPages = originalPdf.getPageCount();
    
    for (let i = 0; i < totalPages; i++) {
      if (i === pageToReplace) {
        // Insert replacement page
        const [copiedPage] = await newPdf.copyPages(replacementPdf, [replacementPage || 0]);
        newPdf.addPage(copiedPage);
      } else {
        // Copy original page
        const [copiedPage] = await newPdf.copyPages(originalPdf, [i]);
        newPdf.addPage(copiedPage);
      }
    }
    
    const modifiedPdfBytes = await newPdf.save();
    const newFileId = await saveProcessedFile(modifiedPdfBytes, 'pdf');
    
    res.json({ success: true, fileId: newFileId });
  } catch (error) {
    console.error('Replace pages error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
