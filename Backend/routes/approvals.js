const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approvalController');
const { managerOnly, sameCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

// Apply company filter middleware to all routes
router.use(sameCompany);

// Approval actions
router.post('/:approvalRequestId/approve', 
  validate('approvalAction'), 
  approvalController.approveExpense
);

router.post('/:approvalRequestId/reject', 
  validate('approvalAction'), 
  approvalController.rejectExpense
);

router.post('/:approvalRequestId/escalate', 
  managerOnly, 
  validate('approvalAction'), 
  approvalController.escalateExpense
);

// Approval request details
router.get('/:approvalRequestId', 
  approvalController.getApprovalRequest
);

// Approval statistics
router.get('/stats', 
  managerOnly, 
  approvalController.getApprovalStats
);

module.exports = router;