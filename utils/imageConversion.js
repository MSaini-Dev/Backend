const { fromPath } = require('pdf2pic');
const sharp = require('sharp');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function convertPdfToImages(pdfPath, dpi = 150) {
  const options = {
    density: dpi,
    saveFilename: uuidv4(),
    savePath: process.env.UPLOAD_DIR,
    format: 'jpg',
    width: 2480,
    height: 3508
  };
  
  const convert = fromPath(pdfPath, options);
  const pageCount = 10; // You'd get this from pdf-parse
  
  const imageFiles = [];
  
  for (let page = 1; page <= pageCount; page++) {
    try {
      const result = await convert(page, { responseType: 'image' });
      imageFiles.push({
        fileId: path.parse(result.name).name,
        filename: result.name,
        page
      });
    } catch (err) {
      console.log(`Page ${page} conversion error:`, err.message);
      break;
    }
  }
  
  return imageFiles;
}

async function convertImageToPdf(imagePath) {
  // Handled in conversions.js
  return null;
}

module.exports = { convertPdfToImages, convertImageToPdf };
