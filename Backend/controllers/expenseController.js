const db = require('../models/database');
const currencyService = require('../models/currencyService');
const ocrService = require('../models/ocrService');
const { saveReceiptFile, deleteFile } = require('../middleware/fileUpload');

class ExpenseController {
  /**
   * Create new expense
   */
  async createExpense(req, res) {
    try {
      const { amount, currency, category, description, expense_date, remarks } = req.body;
      
      // Get company currency for conversion
      const company = await db.get(
        'SELECT currency FROM companies WHERE id = ?',
        [req.user.company_id]
      );

      // Convert currency if different from company currency
      let amountInCompanyCurrency = amount;
      let exchangeRate = 1.0;

      if (currency !== company.currency) {
        const conversion = await currencyService.convertAmount(
          amount, 
          currency, 
          company.currency
        );
        amountInCompanyCurrency = conversion.convertedAmount;
        exchangeRate = conversion.exchangeRate;
      }

      // Create expense record
      const expenseResult = await db.run(
        `INSERT INTO expenses (
          company_id, employee_id, amount, currency, amount_in_company_currency, 
          exchange_rate, category, description, expense_date, remarks, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.company_id, req.user.id, amount, currency || company.currency,
          amountInCompanyCurrency, exchangeRate, category, description, 
          expense_date, remarks || null, 'draft'
        ]
      );

      const expenseId = expenseResult.id;

      // Handle file upload if present
      let receiptPath = null;
      if (req.files && req.files.receipt) {
        try {
          receiptPath = saveReceiptFile(req.files.receipt, expenseId, req.user.id);
          
          // Update expense with receipt path
          await db.run(
            'UPDATE expenses SET receipt_path = ? WHERE id = ?',
            [receiptPath, expenseId]
          );
        } catch (fileError) {
          console.error('File upload error:', fileError);
          // Don't fail the expense creation, just log the error
        }
      }

      // Get the created expense with additional info
      const expense = await db.get(
        `SELECT e.*, u.name as employee_name, c.currency as company_currency
         FROM expenses e
         JOIN users u ON e.employee_id = u.id
         JOIN companies c ON e.company_id = c.id
         WHERE e.id = ?`,
        [expenseId]
      );

      console.log(`Expense created: ID ${expenseId} by ${req.user.email}`);

      res.status(201).json({
        message: 'Expense created successfully',
        expense: {
          ...expense,
          has_receipt: !!receiptPath
        }
      });

    } catch (error) {
      console.error('Create expense error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update expense (only if in draft status)
   */
  async updateExpense(req, res) {
    try {
      const { id } = req.params;
      const { amount, currency, category, description, expense_date, remarks } = req.body;

      // Check if expense exists and belongs to user
      const existingExpense = await db.get(
        'SELECT * FROM expenses WHERE id = ? AND employee_id = ? AND company_id = ?',
        [id, req.user.id, req.user.company_id]
      );

      if (!existingExpense) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      // Only allow updates for draft expenses
      if (existingExpense.status !== 'draft') {
        return res.status(400).json({ 
          error: 'Can only update expenses in draft status' 
        });
      }

      // Get company currency for conversion
      const company = await db.get(
        'SELECT currency FROM companies WHERE id = ?',
        [req.user.company_id]
      );

      // Convert currency if different from company currency
      let amountInCompanyCurrency = amount;
      let exchangeRate = 1.0;

      if (currency !== company.currency) {
        const conversion = await currencyService.convertAmount(
          amount, 
          currency, 
          company.currency
        );
        amountInCompanyCurrency = conversion.convertedAmount;
        exchangeRate = conversion.exchangeRate;
      }

      // Update expense
      await db.run(
        `UPDATE expenses SET 
         amount = COALESCE(?, amount),
         currency = COALESCE(?, currency),
         amount_in_company_currency = COALESCE(?, amount_in_company_currency),
         exchange_rate = COALESCE(?, exchange_rate),
         category = COALESCE(?, category),
         description = COALESCE(?, description),
         expense_date = COALESCE(?, expense_date),
         remarks = ?,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          amount, currency, amountInCompanyCurrency, exchangeRate,
          category, description, expense_date, remarks,
          id
        ]
      );

      // Handle new file upload if present
      if (req.files && req.files.receipt) {
        try {
          // Delete old receipt if exists
          if (existingExpense.receipt_path) {
            deleteFile(existingExpense.receipt_path);
          }

          // Save new receipt
          const receiptPath = saveReceiptFile(req.files.receipt, id, req.user.id);
          await db.run(
            'UPDATE expenses SET receipt_path = ? WHERE id = ?',
            [receiptPath, id]
          );
        } catch (fileError) {
          console.error('File upload error during update:', fileError);
        }
      }

      // Get updated expense
      const updatedExpense = await db.get(
        `SELECT e.*, u.name as employee_name, c.currency as company_currency
         FROM expenses e
         JOIN users u ON e.employee_id = u.id
         JOIN companies c ON e.company_id = c.id
         WHERE e.id = ?`,
        [id]
      );

      console.log(`Expense updated: ID ${id} by ${req.user.email}`);

      res.json({
        message: 'Expense updated successfully',
        expense: {
          ...updatedExpense,
          has_receipt: !!updatedExpense.receipt_path
        }
      });

    } catch (error) {
      console.error('Update expense error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Submit expense for approval
   */
  async submitExpense(req, res) {
    try {
      const { id } = req.params;

      // Check if expense exists and belongs to user
      const expense = await db.get(
        'SELECT * FROM expenses WHERE id = ? AND employee_id = ? AND company_id = ?',
        [id, req.user.id, req.user.company_id]
      );

      if (!expense) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      // Only allow submission for draft expenses
      if (expense.status !== 'draft') {
        return res.status(400).json({ 
          error: 'Can only submit expenses in draft status' 
        });
      }

      // Get active approval rules for the company
      const approvalRule = await db.get(
        'SELECT * FROM approval_rules WHERE company_id = ? AND is_active = 1 LIMIT 1',
        [req.user.company_id]
      );

      if (!approvalRule) {
        return res.status(400).json({ 
          error: 'No active approval rules configured. Contact your administrator.' 
        });
      }

      // Update expense status to submitted
      await db.run(
        'UPDATE expenses SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['submitted', id]
      );

      // Create approval request - this will be handled by approval engine
      // For now, we'll create a basic approval request
      const approvers = await this.getApproversForExpense(expense, approvalRule);
      
      if (approvers.length === 0) {
        // No approvers needed, auto-approve
        await db.run(
          'UPDATE expenses SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['approved', id]
        );

        console.log(`Expense auto-approved: ID ${id} (no approvers required)`);

        return res.json({
          message: 'Expense submitted and automatically approved',
          status: 'approved'
        });
      }

      // Create approval request
      const approvalRequestResult = await db.run(
        'INSERT INTO approval_requests (expense_id, approval_rule_id, status, total_steps) VALUES (?, ?, ?, ?)',
        [id, approvalRule.id, 'pending', approvers.length]
      );

      // Update expense status to waiting approval
      await db.run(
        'UPDATE expenses SET status = ? WHERE id = ?',
        ['waiting_approval', id]
      );

      console.log(`Expense submitted for approval: ID ${id} by ${req.user.email}`);

      res.json({
        message: 'Expense submitted for approval successfully',
        status: 'waiting_approval',
        approval_request_id: approvalRequestResult.id,
        required_approvers: approvers.length
      });

    } catch (error) {
      console.error('Submit expense error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get approvers for expense based on approval rules
   * @private
   */
  async getApproversForExpense(expense, approvalRule) {
    const approvers = [];

    try {
      // If manager approver is required, add the employee's manager
      if (approvalRule.is_manager_approver) {
        const employee = await db.get(
          'SELECT manager_id FROM users WHERE id = ?',
          [expense.employee_id]
        );

        if (employee && employee.manager_id) {
          approvers.push(employee.manager_id);
        }
      }

      // Get approval sequence for this rule
      const sequence = await db.all(
        'SELECT * FROM approval_sequences WHERE approval_rule_id = ? ORDER BY sequence_order',
        [approvalRule.id]
      );

      // Add approvers from sequence
      for (const step of sequence) {
        if (!approvers.includes(step.approver_id)) {
          approvers.push(step.approver_id);
        }
      }

      return approvers;
    } catch (error) {
      console.error('Error getting approvers:', error);
      return [];
    }
  }

  /**
   * Get expense details
   */
  async getExpense(req, res) {
    try {
      const { id } = req.params;

      let query = `
        SELECT e.*, u.name as employee_name, m.name as manager_name,
               c.currency as company_currency
        FROM expenses e
        JOIN users u ON e.employee_id = u.id
        LEFT JOIN users m ON u.manager_id = m.id
        JOIN companies c ON e.company_id = c.id
        WHERE e.id = ? AND e.company_id = ?
      `;
      let queryParams = [id, req.user.company_id];

      // Non-admin users can only see their own expenses or those they can approve
      if (req.user.role !== 'admin') {
        if (req.user.role === 'manager') {
          // Managers can see their team's expenses
          query += ` AND (e.employee_id = ? OR u.manager_id = ?)`;
          queryParams.push(req.user.id, req.user.id);
        } else {
          // Employees can only see their own expenses
          query += ` AND e.employee_id = ?`;
          queryParams.push(req.user.id);
        }
      }

      const expense = await db.get(query, queryParams);

      if (!expense) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      // Get approval history if expense is submitted
      let approvalHistory = [];
      if (expense.status !== 'draft') {
        const approvalRequest = await db.get(
          'SELECT * FROM approval_requests WHERE expense_id = ?',
          [id]
        );

        if (approvalRequest) {
          approvalHistory = await db.all(
            `SELECT aa.*, u.name as approver_name
             FROM approval_actions aa
             JOIN users u ON aa.approver_id = u.id
             WHERE aa.approval_request_id = ?
             ORDER BY aa.created_at DESC`,
            [approvalRequest.id]
          );
        }
      }

      res.json({
        expense: {
          ...expense,
          has_receipt: !!expense.receipt_path
        },
        approval_history: approvalHistory
      });

    } catch (error) {
      console.error('Get expense error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * List expenses with pagination and filters
   */
  async listExpenses(req, res) {
    try {
      const { page, limit, offset } = req.pagination;
      const { status, category, from_date, to_date, employee_id } = req.query;

      let query = `
        SELECT e.id, e.amount, e.currency, e.amount_in_company_currency,
               e.category, e.description, e.expense_date, e.status,
               e.created_at, e.updated_at, u.name as employee_name,
               c.currency as company_currency
        FROM expenses e
        JOIN users u ON e.employee_id = u.id
        JOIN companies c ON e.company_id = c.id
        WHERE e.company_id = ?
      `;
      let queryParams = [req.user.company_id];

      // Apply role-based filtering
      if (req.user.role === 'employee') {
        query += ' AND e.employee_id = ?';
        queryParams.push(req.user.id);
      } else if (req.user.role === 'manager') {
        query += ' AND (e.employee_id = ? OR u.manager_id = ?)';
        queryParams.push(req.user.id, req.user.id);
      }
      // Admin can see all expenses

      // Apply filters
      if (status) {
        query += ' AND e.status = ?';
        queryParams.push(status);
      }

      if (category) {
        query += ' AND e.category = ?';
        queryParams.push(category);
      }

      if (employee_id && req.user.role === 'admin') {
        query += ' AND e.employee_id = ?';
        queryParams.push(employee_id);
      }

      if (from_date) {
        query += ' AND e.expense_date >= ?';
        queryParams.push(from_date);
      }

      if (to_date) {
        query += ' AND e.expense_date <= ?';
        queryParams.push(to_date);
      }

      // Add pagination
      query += ' ORDER BY e.created_at DESC LIMIT ? OFFSET ?';
      queryParams.push(limit, offset);

      const expenses = await db.all(query, queryParams);

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total FROM expenses e
        JOIN users u ON e.employee_id = u.id
        WHERE e.company_id = ?
      `;
      let countParams = [req.user.company_id];

      // Apply same filters to count query
      if (req.user.role === 'employee') {
        countQuery += ' AND e.employee_id = ?';
        countParams.push(req.user.id);
      } else if (req.user.role === 'manager') {
        countQuery += ' AND (e.employee_id = ? OR u.manager_id = ?)';
        countParams.push(req.user.id, req.user.id);
      }

      if (status) {
        countQuery += ' AND e.status = ?';
        countParams.push(status);
      }

      if (category) {
        countQuery += ' AND e.category = ?';
        countParams.push(category);
      }

      if (employee_id && req.user.role === 'admin') {
        countQuery += ' AND e.employee_id = ?';
        countParams.push(employee_id);
      }

      if (from_date) {
        countQuery += ' AND e.expense_date >= ?';
        countParams.push(from_date);
      }

      if (to_date) {
        countQuery += ' AND e.expense_date <= ?';
        countParams.push(to_date);
      }

      const { total } = await db.get(countQuery, countParams);

      res.json({
        expenses: expenses.map(e => ({
          ...e,
          has_receipt: !!e.receipt_path
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('List expenses error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get current user's expenses
   */
  async getMyExpenses(req, res) {
    try {
      const { page, limit, offset } = req.pagination;
      const { status, category } = req.query;

      let query = `
        SELECT e.*, c.currency as company_currency
        FROM expenses e
        JOIN companies c ON e.company_id = c.id
        WHERE e.employee_id = ? AND e.company_id = ?
      `;
      let queryParams = [req.user.id, req.user.company_id];

      // Apply filters
      if (status) {
        query += ' AND e.status = ?';
        queryParams.push(status);
      }

      if (category) {
        query += ' AND e.category = ?';
        queryParams.push(category);
      }

      // Add pagination
      query += ' ORDER BY e.created_at DESC LIMIT ? OFFSET ?';
      queryParams.push(limit, offset);

      const expenses = await db.all(query, queryParams);

      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM expenses WHERE employee_id = ? AND company_id = ?';
      let countParams = [req.user.id, req.user.company_id];

      if (status) {
        countQuery += ' AND status = ?';
        countParams.push(status);
      }

      if (category) {
        countQuery += ' AND category = ?';
        countParams.push(category);
      }

      const { total } = await db.get(countQuery, countParams);

      res.json({
        expenses: expenses.map(e => ({
          ...e,
          has_receipt: !!e.receipt_path
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Get my expenses error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get pending approvals for managers
   */
  async getPendingApprovals(req, res) {
    try {
      const { page, limit, offset } = req.pagination;

      // Only managers and admins can access this
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Manager or admin access required' });
      }

      let query = `
        SELECT e.*, u.name as employee_name, ar.status as approval_status,
               c.currency as company_currency, ar.id as approval_request_id
        FROM expenses e
        JOIN users u ON e.employee_id = u.id
        JOIN companies c ON e.company_id = c.id
        JOIN approval_requests ar ON e.id = ar.expense_id
        WHERE e.company_id = ? AND e.status = 'waiting_approval' AND ar.status = 'pending'
      `;
      let queryParams = [req.user.company_id];

      // For managers, only show expenses they can approve
      if (req.user.role === 'manager') {
        query += ' AND u.manager_id = ?';
        queryParams.push(req.user.id);
      }

      // Add pagination
      query += ' ORDER BY e.created_at ASC LIMIT ? OFFSET ?';
      queryParams.push(limit, offset);

      const expenses = await db.all(query, queryParams);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total FROM expenses e
        JOIN users u ON e.employee_id = u.id
        JOIN approval_requests ar ON e.id = ar.expense_id
        WHERE e.company_id = ? AND e.status = 'waiting_approval' AND ar.status = 'pending'
      `;
      let countParams = [req.user.company_id];

      if (req.user.role === 'manager') {
        countQuery += ' AND u.manager_id = ?';
        countParams.push(req.user.id);
      }

      const { total } = await db.get(countQuery, countParams);

      res.json({
        pending_approvals: expenses.map(e => ({
          ...e,
          has_receipt: !!e.receipt_path
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Get pending approvals error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Delete expense (only drafts, by owner or admin)
   */
  async deleteExpense(req, res) {
    try {
      const { id } = req.params;

      // Check if expense exists
      const expense = await db.get(
        'SELECT * FROM expenses WHERE id = ? AND company_id = ?',
        [id, req.user.company_id]
      );

      if (!expense) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      // Check permissions
      if (req.user.role !== 'admin' && expense.employee_id !== req.user.id) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      // Only allow deletion of draft expenses
      if (expense.status !== 'draft') {
        return res.status(400).json({ 
          error: 'Can only delete expenses in draft status' 
        });
      }

      // Delete associated receipt file if exists
      if (expense.receipt_path) {
        deleteFile(expense.receipt_path);
      }

      // Delete expense
      await db.run('DELETE FROM expenses WHERE id = ?', [id]);

      console.log(`Expense deleted: ID ${id} by ${req.user.email}`);

      res.json({ message: 'Expense deleted successfully' });

    } catch (error) {
      console.error('Delete expense error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = new ExpenseController();