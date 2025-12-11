const express = require('express');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const sharp = require('sharp');
const { getFilePath, saveProcessedFile } = require('../utils/fileHelpers');
const { compressPDF } = require('../utils/compression');
const archiver = require('archiver');
const path = require('path');

const router = express.Router();

// Merge PDFs
router.post('/merge', async (req, res) => {
  try {
    const { fileIds } = req.body;
    
    if (!Array.isArray(fileIds) || fileIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 files required for merging' });
    }

    const mergedPdf = await PDFDocument.create();
    
    for (const fileId of fileIds) {
      const filePath = await getFilePath(fileId);
      const pdfBytes = await fs.readFile(filePath);
      const pdf = await PDFDocument.load(pdfBytes);
      
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach(page => mergedPdf.addPage(page));
    }
    
    const mergedPdfBytes = await mergedPdf.save();
    const newFileId = await saveProcessedFile(mergedPdfBytes, 'pdf');
    
    res.json({ success: true, fileId: newFileId });
  } catch (error) {
    console.error('Merge error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Split PDF
router.post('/split', async (req, res) => {
  try {
    const { fileId, splitType, ranges } = req.body;
    
    const filePath = await getFilePath(fileId);
    const pdfBytes = await fs.readFile(filePath);
    const sourcePdf = await PDFDocument.load(pdfBytes);
    const totalPages = sourcePdf.getPageCount();
    
    const resultFiles = [];
    
    if (splitType === 'ranges' && Array.isArray(ranges)) {
      // Split by specific ranges
      for (const range of ranges) {
        const newPdf = await PDFDocument.create();
        const pagesToCopy = [];
        
        for (let i = range.start; i <= range.end && i < totalPages; i++) {
          pagesToCopy.push(i);
        }
        
        const copiedPages = await newPdf.copyPages(sourcePdf, pagesToCopy);
        copiedPages.forEach(page => newPdf.addPage(page));
        
        const pdfBytes = await newPdf.save();
        const newFileId = await saveProcessedFile(pdfBytes, 'pdf');
        resultFiles.push(newFileId);
      }
    } else if (splitType === 'every' && req.body.pageCount) {
      // Split every X pages
      const pageCount = req.body.pageCount;
      
      for (let i = 0; i < totalPages; i += pageCount) {
        const newPdf = await PDFDocument.create();
        const endPage = Math.min(i + pageCount, totalPages);
        const pagesToCopy = Array.from({ length: endPage - i }, (_, idx) => i + idx);
        
        const copiedPages = await newPdf.copyPages(sourcePdf, pagesToCopy);
        copiedPages.forEach(page => newPdf.addPage(page));
        
        const pdfBytes = await newPdf.save();
        const newFileId = await saveProcessedFile(pdfBytes, 'pdf');
        resultFiles.push(newFileId);
      }
    } else if (splitType === 'individual') {
      // Split into individual pages
      for (let i = 0; i < totalPages; i++) {
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(sourcePdf, [i]);
        newPdf.addPage(copiedPage);
        
        const pdfBytes = await newPdf.save();
        const newFileId = await saveProcessedFile(pdfBytes, 'pdf');
        resultFiles.push(newFileId);
      }
    }
    
    res.json({ success: true, fileIds: resultFiles });
  } catch (error) {
    console.error('Split error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Compress PDF
router.post('/compress', async (req, res) => {
  try {
    const { fileId, quality } = req.body;
    
    const filePath = await getFilePath(fileId);
    const compressedBytes = await compressPDF(filePath, quality || 'medium');
    const newFileId = await saveProcessedFile(compressedBytes, 'pdf');
    
    res.json({ success: true, fileId: newFileId });
  } catch (error) {
    console.error('Compress error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
