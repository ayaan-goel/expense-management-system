const bcrypt = require('bcrypt');
const db = require('../models/database');
const { generateToken } = require('../middleware/auth');

// User signup (registration)
const signup = async (req, res) => {
  try {
    const { name, email, password, countryCode } = req.body;

    // Check if user already exists
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Check if this is the first user (will be admin)
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    const isFirstUser = userCount.count === 0;

    // Hash password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create or get default company
    let company;
    if (isFirstUser) {
      // Create default company for first user
      const companyResult = await db.run(
        'INSERT INTO companies (name, country_code, currency) VALUES (?, ?, ?)',
        ['Default Company', countryCode || 'US', 'USD']
      );
      company = { id: companyResult.id };
    } else {
      // Get the first company (assuming single-tenant for now)
      company = await db.get('SELECT id FROM companies ORDER BY id ASC LIMIT 1');
      if (!company) {
        return res.status(500).json({ error: 'No company found. Please contact administrator.' });
      }
    }

    // Create user
    const result = await db.run(
      'INSERT INTO users (company_id, email, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [company.id, email, password_hash, name, isFirstUser ? 'admin' : 'employee', 1]
    );

    // Get the created user
    const user = await db.get(
      'SELECT id, email, name, role, company_id, is_active FROM users WHERE id = ?',
      [result.id]
    );

    // Generate JWT token
    const token = generateToken(user);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.company_id
      },
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
};

// User login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await db.get(
      'SELECT id, email, password_hash, name, role, company_id, is_active FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated. Please contact administrator.' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.company_id
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
};

// Get current user info
const me = async (req, res) => {
  try {
    const user = req.user; // From authenticateToken middleware
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.company_id,
        manager_id: user.manager_id
      }
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get current password hash
    const user = await db.get(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    );

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db.run(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newPasswordHash, userId]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: Create user
const createUser = async (req, res) => {
  try {
    const { name, email, role, manager_id } = req.body;
    const company_id = req.user.company_id;

    // Check if user already exists
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Validate manager_id if provided
    if (manager_id) {
      const manager = await db.get(
        'SELECT id FROM users WHERE id = ? AND company_id = ? AND role IN ("admin", "manager")',
        [manager_id, company_id]
      );
      if (!manager) {
        return res.status(400).json({ error: 'Invalid manager ID' });
      }
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-12);
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(tempPassword, saltRounds);

    // Create user
    const result = await db.run(
      'INSERT INTO users (company_id, email, password_hash, name, role, manager_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [company_id, email, password_hash, name, role, manager_id || null, 1]
    );

    // Get the created user
    const user = await db.get(
      'SELECT id, email, name, role, company_id, manager_id, is_active FROM users WHERE id = ?',
      [result.id]
    );

    res.status(201).json({
      message: 'User created successfully',
      user,
      temporaryPassword: tempPassword
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: Get all users
const getUsers = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { page, limit, offset } = req.pagination;

    const users = await db.all(
      `SELECT u.id, u.email, u.name, u.role, u.manager_id, u.is_active, u.created_at,
              m.name as manager_name
       FROM users u
       LEFT JOIN users m ON u.manager_id = m.id
       WHERE u.company_id = ?
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [company_id, limit, offset]
    );

    const totalCount = await db.get(
      'SELECT COUNT(*) as count FROM users WHERE company_id = ?',
      [company_id]
    );

    res.json({
      users,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        totalPages: Math.ceil(totalCount.count / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: Update user
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, role, manager_id, is_active } = req.body;
    const company_id = req.user.company_id;

    // Check if user exists in the same company
    const user = await db.get(
      'SELECT id FROM users WHERE id = ? AND company_id = ?',
      [userId, company_id]
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate manager_id if provided
    if (manager_id) {
      const manager = await db.get(
        'SELECT id FROM users WHERE id = ? AND company_id = ? AND role IN ("admin", "manager")',
        [manager_id, company_id]
      );
      if (!manager) {
        return res.status(400).json({ error: 'Invalid manager ID' });
      }
    }

    // Update user
    await db.run(
      'UPDATE users SET name = ?, role = ?, manager_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, role, manager_id || null, is_active, userId]
    );

    // Get updated user
    const updatedUser = await db.get(
      'SELECT id, email, name, role, company_id, manager_id, is_active FROM users WHERE id = ?',
      [userId]
    );

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: Delete user
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const company_id = req.user.company_id;

    // Check if user exists in the same company
    const user = await db.get(
      'SELECT id FROM users WHERE id = ? AND company_id = ?',
      [userId, company_id]
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has pending expenses or approvals
    const hasActiveExpenses = await db.get(
      'SELECT COUNT(*) as count FROM expenses WHERE employee_id = ? AND status IN ("submitted", "waiting_approval")',
      [userId]
    );

    if (hasActiveExpenses.count > 0) {
      return res.status(400).json({
        error: 'Cannot delete user with pending expenses. Please handle all expenses first.'
      });
    }

    // Soft delete by deactivating
    await db.run(
      'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [userId]
    );

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  signup,
  login,
  me,
  changePassword,
  createUser,
  getUsers,
  updateUser,
  deleteUser
};
