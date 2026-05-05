const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, adminOnly } = require('../middleware/auth');
const { validate, validatePagination } = require('../middleware/validation');

// Public routes
router.post('/signup', validate('signup'), authController.signup);
router.post('/login', validate('login'), authController.login);

// Protected routes
router.get('/me', authenticateToken, authController.me);
router.put('/password', authenticateToken, validate('changePassword'), authController.changePassword);

// Admin routes for user management
router.post('/users', authenticateToken, adminOnly, validate('user'), authController.createUser);
router.get('/users', authenticateToken, adminOnly, validatePagination, authController.getUsers);
router.put('/users/:userId', authenticateToken, adminOnly, authController.updateUser);
router.delete('/users/:userId', authenticateToken, adminOnly, authController.deleteUser);

module.exports = router;