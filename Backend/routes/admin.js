const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { adminOnly, sameCompany } = require('../middleware/auth');
const { validate, validatePagination } = require('../middleware/validation');

// Apply admin-only and company filter middleware to all routes
router.use(adminOnly);
router.use(sameCompany);

// Approval Rules Management
router.get('/rules', 
  validatePagination, 
  adminController.getApprovalRules
);

router.post('/rules', 
  validate('approvalRule'), 
  adminController.createApprovalRule
);

router.put('/rules/:ruleId', 
  adminController.updateApprovalRule
);

router.delete('/rules/:ruleId', 
  adminController.deleteApprovalRule
);

// Approval Sequences Management
router.post('/sequences', 
  validate('approvalSequence'), 
  adminController.createApprovalSequence
);

// Expense Management
router.post('/expenses/:id/override', 
  validate('adminOverride'), 
  adminController.overrideExpense
);

router.post('/expenses/bulk-update', 
  adminController.bulkUpdateExpenses
);

// Dashboard and Statistics
router.get('/dashboard', 
  adminController.getDashboardStats
);

router.get('/categories', 
  adminController.getExpenseCategories
);

router.get('/reports', 
  adminController.getExpenseReports
);

module.exports = router;