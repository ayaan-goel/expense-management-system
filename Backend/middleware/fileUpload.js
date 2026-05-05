const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');

// File upload configuration
const uploadConfig = {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  useTempFiles: true,
  tempFileDir: './uploads/temp/',
  uploadTimeout: 60000, // 60 seconds timeout
  abortOnLimit: true,
  responseOnLimit: "File size limit exceeded",
  debug: false
};

// Create upload directories if they don't exist
const createUploadDirs = () => {
  const dirs = [
    './uploads',
    './uploads/temp',
    './uploads/receipts',
    './uploads/ocr'
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
};

// Initialize upload directories
createUploadDirs();

// File upload middleware
const upload = fileUpload(uploadConfig);

// Save uploaded receipt file to permanent location
const saveReceiptFile = (file, expenseId, userId) => {
  try {
    // Generate unique filename
    const fileExtension = path.extname(file.name);
    const timestamp = Date.now();
    const fileName = `expense_${expenseId}_${userId}_${timestamp}${fileExtension}`;
    const permanentPath = path.join('./uploads/receipts', fileName);
    
    // Move file from temp location to permanent location
    file.mv(permanentPath);
    
    console.log(`Receipt file saved: ${permanentPath}`);
    return permanentPath;
  } catch (error) {
    console.error('Error saving receipt file:', error);
    throw error;
  }
};

// Save OCR file to permanent location
const saveOCRFile = (file, userId) => {
  try {
    // Generate unique filename for OCR processing
    const fileExtension = path.extname(file.name);
    const timestamp = Date.now();
    const fileName = `ocr_${userId}_${timestamp}${fileExtension}`;
    const permanentPath = path.join('./uploads/ocr', fileName);
    
    // Move file from temp location to permanent location
    file.mv(permanentPath);
    
    console.log(`OCR file saved: ${permanentPath}`);
    return permanentPath;
  } catch (error) {
    console.error('Error saving OCR file:', error);
    throw error;
  }
};

// Clean up temp files older than 1 hour
const cleanupTempFiles = () => {
  try {
    const tempDir = './uploads/temp';
    const files = fs.readdirSync(tempDir);
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.mtime.getTime() < oneHourAgo) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up temp file: ${filePath}`);
      }
    });
  } catch (error) {
    console.error('Error cleaning up temp files:', error);
  }
};

// Run cleanup every hour
setInterval(cleanupTempFiles, 60 * 60 * 1000);

// Validate uploaded file for receipts
const validateReceiptFile = (req, res, next) => {
  if (!req.files || !req.files.receipt) {
    return res.status(400).json({ error: 'Receipt file is required' });
  }

  const file = req.files.receipt;
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'application/pdf'
  ];
  
  const maxSize = 10 * 1024 * 1024; // 10MB

  // Validate file type
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return res.status(400).json({
      error: 'Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed.'
    });
  }

  // Validate file size
  if (file.size > maxSize) {
    return res.status(400).json({
      error: 'File size too large. Maximum size is 10MB.'
    });
  }

  // Validate file name (basic security check)
  const fileName = file.name;
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return res.status(400).json({
      error: 'Invalid file name.'
    });
  }

  next();
};

// Get file extension from mime type
const getExtensionFromMimeType = (mimeType) => {
  const extensions = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'application/pdf': '.pdf'
  };

  return extensions[mimeType] || '.bin';
};

// Delete file helper
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted file: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

// Get file info
const getFileInfo = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);
    return {
      exists: true,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      extension: path.extname(filePath),
      name: path.basename(filePath)
    };
  } catch (error) {
    console.error('Error getting file info:', error);
    return null;
  }
};

module.exports = {
  upload,
  saveReceiptFile,
  saveOCRFile,
  validateReceiptFile,
  cleanupTempFiles,
  deleteFile,
  getFileInfo,
  getExtensionFromMimeType
};