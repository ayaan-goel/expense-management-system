const Joi = require('joi');

// Validation schemas
const schemas = {
  // User registration/signup
  signup: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    countryCode: Joi.string().length(2).optional()
  }),

  // User login
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  // Create/Update user (admin)
  user: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    role: Joi.string().valid('admin', 'manager', 'employee').required(),
    manager_id: Joi.number().integer().min(1).optional().allow(null)
  }),

  // Create/Update expense
  expense: Joi.object({
    amount: Joi.number().positive().precision(2).required(),
    currency: Joi.string().length(3).uppercase().default('USD'),
    category: Joi.string().min(2).max(100).required(),
    description: Joi.string().min(5).max(500).required(),
    expense_date: Joi.date().max('now').required(),
    remarks: Joi.string().max(500).optional()
  }),

  // Submit expense (just expense ID)
  submitExpense: Joi.object({
    id: Joi.number().integer().min(1).required()
  }),

  // Approval action
  approvalAction: Joi.object({
    action: Joi.string().valid('approve', 'reject', 'escalate').required(),
    comments: Joi.string().max(500).optional()
  }),

  // Create approval rule
  approvalRule: Joi.object({
    name: Joi.string().min(3).max(100).required(),
    description: Joi.string().max(500).optional(),
    rule_type: Joi.string().valid('percentage', 'specific_approver', 'hybrid').required(),
    percentage_threshold: Joi.number().min(0).max(100).when('rule_type', {
      is: Joi.string().valid('percentage', 'hybrid'),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    specific_approver_id: Joi.number().integer().min(1).when('rule_type', {
      is: Joi.string().valid('specific_approver', 'hybrid'),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    is_manager_approver: Joi.boolean().default(false)
  }),

  // Create approval sequence
  approvalSequence: Joi.object({
    approval_rule_id: Joi.number().integer().min(1).required(),
    approvers: Joi.array().items(
      Joi.object({
        approver_id: Joi.number().integer().min(1).required(),
        sequence_order: Joi.number().integer().min(1).required(),
        is_required: Joi.boolean().default(true)
      })
    ).min(1).required()
  }),

  // Update user password
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).required()
  }),

  // Admin override
  adminOverride: Joi.object({
    action: Joi.string().valid('approve', 'reject').required(),
    comments: Joi.string().min(5).max(500).required()
  }),

  // OCR file upload validation
  ocrUpload: Joi.object({
    file: Joi.object({
      mimetype: Joi.string().valid('image/jpeg', 'image/jpg', 'image/png', 'application/pdf').required(),
      size: Joi.number().max(10 * 1024 * 1024) // 10MB max
    }).unknown(true)
  }),

  // Create expense from OCR data
  createExpenseFromOcr: Joi.object({
    amount: Joi.number().positive().precision(2).optional(),
    currency: Joi.string().length(3).uppercase().optional(),
    category: Joi.string().min(2).max(100).optional(),
    description: Joi.string().min(5).max(500).optional(),
    expense_date: Joi.date().max('now').optional(),
    remarks: Joi.string().max(500).optional()
  })
};

// Validation middleware factory
const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return res.status(500).json({ error: 'Internal validation error: schema not found' });
    }

    // For file uploads, validate files separately
    if (schemaName === 'ocrUpload' && req.files && req.files.receipt) {
      const fileValidation = schemas.ocrUpload.validate({ file: req.files.receipt });
      if (fileValidation.error) {
        return res.status(400).json({
          error: 'File validation failed',
          details: fileValidation.error.details.map(detail => detail.message)
        });
      }
    }

    // Validate request body
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Show all validation errors
      stripUnknown: true // Remove unknown fields
    });

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

// Custom validation for expense amount limits
const validateExpenseAmount = (req, res, next) => {
  const { amount } = req.body;
  
  // Set company-specific limits (can be made configurable)
  const MAX_EXPENSE_AMOUNT = 50000; // $50,000 or equivalent
  
  if (amount > MAX_EXPENSE_AMOUNT) {
    return res.status(400).json({
      error: `Expense amount cannot exceed ${MAX_EXPENSE_AMOUNT}`
    });
  }

  next();
};

// Validate date ranges
const validateDateRange = (req, res, next) => {
  const { from_date, to_date } = req.query;

  if (from_date && to_date) {
    const fromDate = new Date(from_date);
    const toDate = new Date(to_date);

    if (fromDate > toDate) {
      return res.status(400).json({
        error: 'From date must be before or equal to to date'
      });
    }

    // Limit date range to 1 year for performance
    const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
    if (toDate.getTime() - fromDate.getTime() > oneYearInMs) {
      return res.status(400).json({
        error: 'Date range cannot exceed 1 year'
      });
    }
  }

  next();
};

// File upload validation
const validateFileUpload = (req, res, next) => {
  if (!req.files || !req.files.receipt) {
    return res.status(400).json({ error: 'Receipt file is required' });
  }

  const file = req.files.receipt;
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({
      error: 'Invalid file type. Only JPEG, PNG, and PDF files are allowed.'
    });
  }

  if (file.size > maxSize) {
    return res.status(400).json({
      error: 'File size too large. Maximum size is 10MB.'
    });
  }

  next();
};

// Validate pagination parameters
const validatePagination = (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (page < 1) {
    return res.status(400).json({ error: 'Page must be a positive number' });
  }

  if (limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'Limit must be between 1 and 100' });
  }

  req.pagination = {
    page,
    limit,
    offset: (page - 1) * limit
  };

  next();
};

module.exports = {
  validate,
  validateExpenseAmount,
  validateDateRange,
  validateFileUpload,
  validatePagination,
  schemas
};