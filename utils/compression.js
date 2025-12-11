const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;

async function compressPDF(filePath, quality) {
  const pdfBytes = await fs.readFile(filePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  
  // Basic compression by re-saving
  // For advanced compression, you would use Ghostscript or similar
  const compressed = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50
  });
  
  return compressed;
}

module.exports = { compressPDF };
