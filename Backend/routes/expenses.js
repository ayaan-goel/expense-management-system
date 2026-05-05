const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { 
  adminOnly, 
  managerOnly, 
  employeeOnly, 
  ownerOrAdmin, 
  sameCompany 
} = require('../middleware/auth');
const { 
  validate, 
  validateExpenseAmount, 
  validateDateRange, 
  validateFileUpload, 
  validatePagination 
} = require('../middleware/validation');

// Apply company filter middleware to all routes
router.use(sameCompany);

// Expense CRUD routes
router.post('/', 
  employeeOnly, 
  validate('expense'), 
  validateExpenseAmount, 
  expenseController.createExpense
);

router.get('/', 
  validatePagination, 
  validateDateRange, 
  expenseController.listExpenses
);

router.get('/my', 
  employeeOnly, 
  validatePagination, 
  expenseController.getMyExpenses
);

router.get('/pending', 
  managerOnly, 
  validatePagination, 
  expenseController.getPendingApprovals
);

router.get('/:id', 
  ownerOrAdmin, 
  expenseController.getExpense
);

router.put('/:id', 
  ownerOrAdmin, 
  validate('expense'), 
  validateExpenseAmount, 
  expenseController.updateExpense
);

router.delete('/:id', 
  ownerOrAdmin, 
  expenseController.deleteExpense
);

// Expense submission
router.post('/:id/submit', 
  ownerOrAdmin, 
  expenseController.submitExpense
);

module.exports = router;