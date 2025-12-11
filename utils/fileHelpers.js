const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function getFilePath(fileId) {
  const uploadDir = process.env.UPLOAD_DIR;
  const files = await fs.readdir(uploadDir);
  const targetFile = files.find(f => f.startsWith(fileId) && !f.endsWith('.json'));
  
  if (!targetFile) {
    throw new Error('File not found');
  }
  
  return path.join(uploadDir, targetFile);
}

async function saveProcessedFile(fileBytes, extension) {
  const fileId = uuidv4();
  const filename = `${fileId}.${extension}`;
  const filePath = path.join(process.env.UPLOAD_DIR, filename);
  
  await fs.writeFile(filePath, fileBytes);
  
  // Create metadata
  const metadata = {
    fileId,
    filename,
    size: fileBytes.length,
    uploadedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + parseInt(process.env.FILE_RETENTION_MINUTES) * 60000).toISOString()
  };
  
  const metadataPath = path.join(process.env.UPLOAD_DIR, `${fileId}.json`);
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  
  return fileId;
}

module.exports = { getFilePath, saveProcessedFile };
