const jwt = require('jsonwebtoken');
const db = require('../models/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      company_id: user.company_id
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Verify JWT token middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get fresh user data from database
    const user = await db.get(
      'SELECT * FROM users WHERE id = ? AND is_active = 1',
      [decoded.id]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid token or user not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Role-based access control middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const managerOnly = (req, res, next) => {
  if (!['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager or admin access required' });
  }
  next();
};

const employeeOnly = (req, res, next) => {
  if (!['admin', 'manager', 'employee'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Employee access required' });
  }
  next();
};

// Check if user owns the resource or is admin
const ownerOrAdmin = async (req, res, next) => {
  try {
    const resourceId = req.params.id || req.params.userId;
    
    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if the user owns the resource (for user-specific resources)
    if (req.params.userId && req.user.id.toString() === req.params.userId) {
      return next();
    }

    // For expense resources, check if user owns the expense
    if (req.params.id && req.route.path.includes('expenses')) {
      const expense = await db.get(
        'SELECT employee_id FROM expenses WHERE id = ?',
        [req.params.id]
      );
      
      if (expense && expense.employee_id === req.user.id) {
        return next();
      }
    }

    return res.status(403).json({ error: 'Access denied: insufficient permissions' });
  } catch (err) {
    console.error('Owner/Admin check error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Check if user is manager of the resource owner or admin
const managerOrAdmin = async (req, res, next) => {
  try {
    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Manager can access their team's resources
    if (req.user.role === 'manager') {
      // For expense approvals, check if manager is in the approval chain
      if (req.route.path.includes('approval')) {
        // This will be validated in the approval controller
        return next();
      }

      // For viewing team expenses
      const teamMembers = await db.all(
        'SELECT id FROM users WHERE manager_id = ? AND company_id = ?',
        [req.user.id, req.user.company_id]
      );
      
      const teamMemberIds = teamMembers.map(member => member.id);
      req.teamMemberIds = teamMemberIds; // Store for use in controller
      
      return next();
    }

    return res.status(403).json({ error: 'Manager or admin access required' });
  } catch (err) {
    console.error('Manager/Admin check error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Check same company access
const sameCompany = (req, res, next) => {
  // This middleware ensures users can only access resources from their own company
  req.companyFilter = { company_id: req.user.company_id };
  next();
};

module.exports = {
  generateToken,
  authenticateToken,
  adminOnly,
  managerOnly,
  employeeOnly,
  ownerOrAdmin,
  managerOrAdmin,
  sameCompany
};