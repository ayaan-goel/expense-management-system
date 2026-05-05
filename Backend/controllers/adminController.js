const db = require('../models/database');

class AdminController {
  /**
   * Get all approval rules
   */
  async getApprovalRules(req, res) {
    try {
      const { page, limit, offset } = req.pagination;

      // Get approval rules with associated sequences
      const rules = await db.all(
        `SELECT ar.*, u.name as specific_approver_name
         FROM approval_rules ar
         LEFT JOIN users u ON ar.specific_approver_id = u.id
         WHERE ar.company_id = ?
         ORDER BY ar.created_at DESC
         LIMIT ? OFFSET ?`,
        [req.user.company_id, limit, offset]
      );

      // Get sequences for each rule
      for (const rule of rules) {
        rule.sequences = await db.all(
          `SELECT s.*, u.name as approver_name, u.role as approver_role
           FROM approval_sequences s
           JOIN users u ON s.approver_id = u.id
           WHERE s.approval_rule_id = ?
           ORDER BY s.sequence_order`,
          [rule.id]
        );
      }

      // Get total count
      const { total } = await db.get(
        'SELECT COUNT(*) as total FROM approval_rules WHERE company_id = ?',
        [req.user.company_id]
      );

      res.json({
        approval_rules: rules,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Get approval rules error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Create new approval rule
   */
  async createApprovalRule(req, res) {
    try {
      const { 
        name, 
        description, 
        rule_type, 
        percentage_threshold, 
        specific_approver_id, 
        is_manager_approver 
      } = req.body;

      // Validate specific approver if provided
      if (specific_approver_id) {
        const approver = await db.get(
          'SELECT id, role FROM users WHERE id = ? AND company_id = ? AND is_active = 1',
          [specific_approver_id, req.user.company_id]
        );

        if (!approver) {
          return res.status(400).json({ error: 'Specific approver not found' });
        }

        if (!['admin', 'manager'].includes(approver.role)) {
          return res.status(400).json({ 
            error: 'Specific approver must have manager or admin role' 
          });
        }
      }

      // Create approval rule
      const ruleResult = await db.run(
        `INSERT INTO approval_rules (
          company_id, name, description, rule_type, percentage_threshold, 
          specific_approver_id, is_manager_approver, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.company_id, name, description, rule_type,
          percentage_threshold, specific_approver_id, 
          is_manager_approver || 0, 1
        ]
      );

      // Get the created rule with additional info
      const createdRule = await db.get(
        `SELECT ar.*, u.name as specific_approver_name
         FROM approval_rules ar
         LEFT JOIN users u ON ar.specific_approver_id = u.id
         WHERE ar.id = ?`,
        [ruleResult.id]
      );

      console.log(`Approval rule created: ${name} by ${req.user.email}`);

      res.status(201).json({
        message: 'Approval rule created successfully',
        approval_rule: createdRule
      });

    } catch (error) {
      console.error('Create approval rule error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update approval rule
   */
  async updateApprovalRule(req, res) {
    try {
      const { ruleId } = req.params;
      const { 
        name, 
        description, 
        rule_type, 
        percentage_threshold, 
        specific_approver_id, 
        is_manager_approver, 
        is_active 
      } = req.body;

      // Check if rule exists and belongs to company
      const existingRule = await db.get(
        'SELECT * FROM approval_rules WHERE id = ? AND company_id = ?',
        [ruleId, req.user.company_id]
      );

      if (!existingRule) {
        return res.status(404).json({ error: 'Approval rule not found' });
      }

      // Validate specific approver if provided
      if (specific_approver_id) {
        const approver = await db.get(
          'SELECT id, role FROM users WHERE id = ? AND company_id = ? AND is_active = 1',
          [specific_approver_id, req.user.company_id]
        );

        if (!approver) {
          return res.status(400).json({ error: 'Specific approver not found' });
        }

        if (!['admin', 'manager'].includes(approver.role)) {
          return res.status(400).json({ 
            error: 'Specific approver must have manager or admin role' 
          });
        }
      }

      // Update approval rule
      await db.run(
        `UPDATE approval_rules SET 
         name = COALESCE(?, name),
         description = COALESCE(?, description),
         rule_type = COALESCE(?, rule_type),
         percentage_threshold = COALESCE(?, percentage_threshold),
         specific_approver_id = ?,
         is_manager_approver = COALESCE(?, is_manager_approver),
         is_active = COALESCE(?, is_active),
         updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          name, description, rule_type, percentage_threshold,
          specific_approver_id, is_manager_approver, is_active,
          ruleId
        ]
      );

      // Get updated rule
      const updatedRule = await db.get(
        `SELECT ar.*, u.name as specific_approver_name
         FROM approval_rules ar
         LEFT JOIN users u ON ar.specific_approver_id = u.id
         WHERE ar.id = ?`,
        [ruleId]
      );

      console.log(`Approval rule updated: ID ${ruleId} by ${req.user.email}`);

      res.json({
        message: 'Approval rule updated successfully',
        approval_rule: updatedRule
      });

    } catch (error) {
      console.error('Update approval rule error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Create approval sequence
   */
  async createApprovalSequence(req, res) {
    try {
      const { approval_rule_id, approvers } = req.body;

      // Check if approval rule exists and belongs to company
      const approvalRule = await db.get(
        'SELECT * FROM approval_rules WHERE id = ? AND company_id = ?',
        [approval_rule_id, req.user.company_id]
      );

      if (!approvalRule) {
        return res.status(404).json({ error: 'Approval rule not found' });
      }

      // Validate all approvers
      for (const approver of approvers) {
        const user = await db.get(
          'SELECT id, role FROM users WHERE id = ? AND company_id = ? AND is_active = 1',
          [approver.approver_id, req.user.company_id]
        );

        if (!user) {
          return res.status(400).json({ 
            error: `Approver with ID ${approver.approver_id} not found` 
          });
        }

        if (!['admin', 'manager'].includes(user.role)) {
          return res.status(400).json({ 
            error: `User ${approver.approver_id} must have manager or admin role` 
          });
        }
      }

      // Clear existing sequences for this rule
      await db.run(
        'DELETE FROM approval_sequences WHERE approval_rule_id = ?',
        [approval_rule_id]
      );

      // Create new sequences
      for (const approver of approvers) {
        await db.run(
          'INSERT INTO approval_sequences (approval_rule_id, approver_id, sequence_order, is_required) VALUES (?, ?, ?, ?)',
          [approval_rule_id, approver.approver_id, approver.sequence_order, approver.is_required || 1]
        );
      }

      // Get created sequences
      const sequences = await db.all(
        `SELECT s.*, u.name as approver_name, u.role as approver_role
         FROM approval_sequences s
         JOIN users u ON s.approver_id = u.id
         WHERE s.approval_rule_id = ?
         ORDER BY s.sequence_order`,
        [approval_rule_id]
      );

      console.log(`Approval sequences created for rule ID ${approval_rule_id} by ${req.user.email}`);

      res.status(201).json({
        message: 'Approval sequences created successfully',
        sequences
      });

    } catch (error) {
      console.error('Create approval sequence error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Admin override expense approval
   */
  async overrideExpense(req, res) {
    try {
      const { id } = req.params;
      const { action, comments } = req.body;

      // Check if expense exists and belongs to company
      const expense = await db.get(
        `SELECT e.*, u.name as employee_name
         FROM expenses e
         JOIN users u ON e.employee_id = u.id
         WHERE e.id = ? AND e.company_id = ?`,
        [id, req.user.company_id]
      );

      if (!expense) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      // Check if expense can be overridden
      if (!['waiting_approval', 'submitted', 'escalated'].includes(expense.status)) {
        return res.status(400).json({ 
          error: 'Can only override expenses that are pending approval' 
        });
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      // Update expense status
      await db.run(
        'UPDATE expenses SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newStatus, id]
      );

      // Get any existing approval request
      const approvalRequest = await db.get(
        'SELECT * FROM approval_requests WHERE expense_id = ?',
        [id]
      );

      if (approvalRequest) {
        // Update approval request status
        await db.run(
          'UPDATE approval_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newStatus, approvalRequest.id]
        );

        // Record admin override action
        await db.run(
          `INSERT INTO approval_actions (approval_request_id, approver_id, action, comments, step_number)
           VALUES (?, ?, ?, ?, ?)`,
          [approvalRequest.id, req.user.id, action, `ADMIN OVERRIDE: ${comments}`, 999]
        );
      }

      console.log(`Admin override: Expense ID ${id} ${action}d by ${req.user.email}`);

      res.json({
        message: `Expense ${action}d successfully via admin override`,
        expense: {
          id: expense.id,
          status: newStatus,
          employee_name: expense.employee_name,
          amount: expense.amount_in_company_currency,
          description: expense.description
        }
      });

    } catch (error) {
      console.error('Admin override error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get company dashboard statistics (admin only)
   */
  async getDashboardStats(req, res) {
    try {
      // Get expense statistics
      const expenseStats = await db.get(`
        SELECT 
          COUNT(*) as total_expenses,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
          SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
          SUM(CASE WHEN status = 'waiting_approval' THEN 1 ELSE 0 END) as waiting_approval,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
          SUM(CASE WHEN status = 'approved' THEN amount_in_company_currency ELSE 0 END) as total_approved_amount,
          AVG(CASE WHEN status = 'approved' THEN amount_in_company_currency ELSE NULL END) as avg_expense_amount
        FROM expenses 
        WHERE company_id = ?
      `, [req.user.company_id]);

      // Get user statistics
      const userStats = await db.get(`
        SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
          SUM(CASE WHEN role = 'manager' THEN 1 ELSE 0 END) as managers,
          SUM(CASE WHEN role = 'employee' THEN 1 ELSE 0 END) as employees,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users
        FROM users 
        WHERE company_id = ?
      `, [req.user.company_id]);

      // Get approval statistics
      const approvalStats = await db.get(`
        SELECT 
          COUNT(*) as total_approval_requests,
          SUM(CASE WHEN ar.status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN ar.status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN ar.status = 'rejected' THEN 1 ELSE 0 END) as rejected,
          AVG(CASE WHEN ar.status = 'approved' 
              THEN JULIANDAY(ar.updated_at) - JULIANDAY(ar.created_at) 
              ELSE NULL END) as avg_approval_time_days
        FROM approval_requests ar
        JOIN expenses e ON ar.expense_id = e.id
        WHERE e.company_id = ?
      `, [req.user.company_id]);

      // Get recent activities (last 10 actions)
      const recentActivities = await db.all(`
        SELECT 
          'expense_' || e.status as activity_type,
          e.id as expense_id,
          e.description as expense_description,
          e.amount_in_company_currency as amount,
          u.name as employee_name,
          e.updated_at as activity_time
        FROM expenses e
        JOIN users u ON e.employee_id = u.id
        WHERE e.company_id = ?
        ORDER BY e.updated_at DESC
        LIMIT 10
      `, [req.user.company_id]);

      // Get company currency
      const company = await db.get(
        'SELECT currency FROM companies WHERE id = ?',
        [req.user.company_id]
      );

      res.json({
        expense_statistics: {
          ...expenseStats,
          total_approved_amount: expenseStats.total_approved_amount || 0,
          avg_expense_amount: expenseStats.avg_expense_amount ? 
            Math.round(expenseStats.avg_expense_amount * 100) / 100 : 0
        },
        user_statistics: userStats,
        approval_statistics: {
          ...approvalStats,
          avg_approval_time_days: approvalStats.avg_approval_time_days ? 
            Math.round(approvalStats.avg_approval_time_days * 10) / 10 : 0
        },
        recent_activities: recentActivities,
        company_currency: company.currency
      });

    } catch (error) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get expense categories with usage statistics
   */
  async getExpenseCategories(req, res) {
    try {
      const categories = await db.all(`
        SELECT 
          category,
          COUNT(*) as usage_count,
          SUM(amount_in_company_currency) as total_amount,
          AVG(amount_in_company_currency) as avg_amount
        FROM expenses 
        WHERE company_id = ?
        GROUP BY category
        ORDER BY usage_count DESC
      `, [req.user.company_id]);

      res.json({ categories });

    } catch (error) {
      console.error('Get expense categories error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get expense reports
   */
  async getExpenseReports(req, res) {
    try {
      const { type, from_date, to_date, employee_id } = req.query;

      let whereClause = 'WHERE e.company_id = ?';
      let queryParams = [req.user.company_id];

      if (from_date) {
        whereClause += ' AND e.expense_date >= ?';
        queryParams.push(from_date);
      }

      if (to_date) {
        whereClause += ' AND e.expense_date <= ?';
        queryParams.push(to_date);
      }

      if (employee_id) {
        whereClause += ' AND e.employee_id = ?';
        queryParams.push(employee_id);
      }

      let groupBy = '';
      let selectFields = '';

      switch (type) {
        case 'monthly':
          selectFields = `strftime('%Y-%m', e.expense_date) as period,`;
          groupBy = `GROUP BY strftime('%Y-%m', e.expense_date)`;
          break;
        case 'weekly':
          selectFields = `strftime('%Y-W%W', e.expense_date) as period,`;
          groupBy = `GROUP BY strftime('%Y-W%W', e.expense_date)`;
          break;
        case 'category':
          selectFields = 'e.category as period,';
          groupBy = 'GROUP BY e.category';
          break;
        case 'employee':
          selectFields = 'u.name as period,';
          groupBy = 'GROUP BY e.employee_id, u.name';
          break;
        default:
          selectFields = `DATE(e.expense_date) as period,`;
          groupBy = `GROUP BY DATE(e.expense_date)`;
      }

      const reports = await db.all(`
        SELECT 
          ${selectFields}
          COUNT(*) as expense_count,
          SUM(e.amount_in_company_currency) as total_amount,
          AVG(e.amount_in_company_currency) as avg_amount,
          SUM(CASE WHEN e.status = 'approved' THEN e.amount_in_company_currency ELSE 0 END) as approved_amount,
          SUM(CASE WHEN e.status = 'approved' THEN 1 ELSE 0 END) as approved_count
        FROM expenses e
        JOIN users u ON e.employee_id = u.id
        ${whereClause}
        ${groupBy}
        ORDER BY period DESC
        LIMIT 50
      `, queryParams);

      res.json({
        report_type: type || 'daily',
        reports: reports.map(r => ({
          ...r,
          total_amount: Math.round(r.total_amount * 100) / 100,
          avg_amount: Math.round(r.avg_amount * 100) / 100,
          approved_amount: Math.round(r.approved_amount * 100) / 100
        }))
      });

    } catch (error) {
      console.error('Get expense reports error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Delete approval rule
   */
  async deleteApprovalRule(req, res) {
    try {
      const { ruleId } = req.params;

      // Check if rule exists and belongs to company
      const rule = await db.get(
        'SELECT * FROM approval_rules WHERE id = ? AND company_id = ?',
        [ruleId, req.user.company_id]
      );

      if (!rule) {
        return res.status(404).json({ error: 'Approval rule not found' });
      }

      // Check if rule is being used in active approval requests
      const activeRequests = await db.get(
        `SELECT COUNT(*) as count FROM approval_requests ar
         JOIN expenses e ON ar.expense_id = e.id
         WHERE ar.approval_rule_id = ? AND ar.status = 'pending'`,
        [ruleId]
      );

      if (activeRequests.count > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete approval rule that has active approval requests' 
        });
      }

      // Delete associated sequences first
      await db.run(
        'DELETE FROM approval_sequences WHERE approval_rule_id = ?',
        [ruleId]
      );

      // Delete the rule
      await db.run(
        'DELETE FROM approval_rules WHERE id = ?',
        [ruleId]
      );

      console.log(`Approval rule deleted: ID ${ruleId} by ${req.user.email}`);

      res.json({ message: 'Approval rule deleted successfully' });

    } catch (error) {
      console.error('Delete approval rule error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Bulk update expenses (admin only)
   */
  async bulkUpdateExpenses(req, res) {
    try {
      const { expense_ids, action, comments } = req.body;

      if (!expense_ids || !Array.isArray(expense_ids) || expense_ids.length === 0) {
        return res.status(400).json({ error: 'expense_ids array is required' });
      }

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'action must be approve or reject' });
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      let updatedCount = 0;

      for (const expenseId of expense_ids) {
        try {
          // Check if expense exists and belongs to company
          const expense = await db.get(
            'SELECT * FROM expenses WHERE id = ? AND company_id = ?',
            [expenseId, req.user.company_id]
          );

          if (!expense || !['waiting_approval', 'submitted', 'escalated'].includes(expense.status)) {
            continue; // Skip this expense
          }

          // Update expense
          await db.run(
            'UPDATE expenses SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newStatus, expenseId]
          );

          // Update any related approval requests
          const approvalRequest = await db.get(
            'SELECT * FROM approval_requests WHERE expense_id = ?',
            [expenseId]
          );

          if (approvalRequest) {
            await db.run(
              'UPDATE approval_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [newStatus, approvalRequest.id]
            );

            // Record bulk action
            await db.run(
              `INSERT INTO approval_actions (approval_request_id, approver_id, action, comments, step_number)
               VALUES (?, ?, ?, ?, ?)`,
              [approvalRequest.id, req.user.id, action, `BULK ${action.toUpperCase()}: ${comments}`, 999]
            );
          }

          updatedCount++;
        } catch (error) {
          console.error(`Error updating expense ${expenseId}:`, error);
          continue; // Continue with next expense
        }
      }

      console.log(`Bulk ${action}: ${updatedCount} expenses by ${req.user.email}`);

      res.json({
        message: `Bulk ${action} completed successfully`,
        updated_count: updatedCount,
        total_requested: expense_ids.length
      });

    } catch (error) {
      console.error('Bulk update expenses error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = new AdminController();