const express = require('express');
const router = express.Router();
const ocrController = require('../controllers/ocrController');
const { authenticateToken, adminOnly, sameCompany } = require('../middleware/auth');
const { validate, validatePagination } = require('../middleware/validation');
const { validateReceiptFile } = require('../middleware/fileUpload');

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(sameCompany);

// Receipt Processing
router.post('/process', 
  validateReceiptFile,
  validate('ocrUpload'), 
  ocrController.processReceipt
);

// Get OCR Results
router.get('/results/:ocrId', 
  ocrController.getOcrResult
);

// Create Expense from OCR
router.post('/create-expense/:ocrId', 
  validate('createExpenseFromOcr'), 
  ocrController.createExpenseFromOcr
);

// Admin-only endpoints
router.get('/stats', 
  adminOnly,
  ocrController.getOcrStats
);

router.post('/reprocess/:ocrId', 
  adminOnly,
  ocrController.reprocessOcr
);

router.get('/results',
  adminOnly,
  validatePagination,
  ocrController.getAllOcrResults
);

module.exports = router;