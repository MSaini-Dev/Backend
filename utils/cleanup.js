const fs = require('fs');
const path = require('path');

function cleanupOldFiles() {
  const uploadDir = process.env.UPLOAD_DIR;
  const retentionMinutes = parseInt(process.env.FILE_RETENTION_MINUTES);
  const now = Date.now();
  
  try {
    const files = fs.readdirSync(uploadDir);
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);
      const fileAge = (now - stats.mtimeMs) / 1000 / 60; // in minutes
      
      if (fileAge > retentionMinutes) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`Deleted: ${file}`);
      }
    }
    
    console.log(`Cleanup complete. Deleted ${deletedCount} files.`);
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

module.exports = { cleanupOldFiles };
