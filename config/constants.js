module.exports = {
  // File constraints
  MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || 52428800, // 50MB
  FILE_RETENTION_MINUTES: process.env.FILE_RETENTION_MINUTES || 20,
  
  // Supported formats
  ALLOWED_EXTENSIONS: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
  
  // Compression levels
  COMPRESSION_LEVELS: {
    high: 0.3,
    medium: 0.6,
    low: 0.9,
  },
  
  // OCR languages
  OCR_LANGUAGES: ['eng', 'hin', 'eng+hin'],
  
  // Rate limiting
  RATE_LIMITS: {
    general: 100,
    upload: 20,
    conversion: 30,
    download: 50,
  },
};
