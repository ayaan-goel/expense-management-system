const db = require('../models/database');

class ApprovalController {
  /**
   * Approve expense
   */
  async approveExpense(req, res) {
    try {
      const { approvalRequestId } = req.params;
      const { comments } = req.body;

      // Get approval request details
      const approvalRequest = await db.get(
        `SELECT ar.*, e.employee_id, e.amount_in_company_currency, 
                e.description, e.company_id, u.name as employee_name,
                rule.rule_type, rule.percentage_threshold, rule.specific_approver_id
         FROM approval_requests ar
         JOIN expenses e ON ar.expense_id = e.id
         JOIN users u ON e.employee_id = u.id
         JOIN approval_rules rule ON ar.approval_rule_id = rule.id
         WHERE ar.id = ?`,
        [approvalRequestId]
      );

      if (!approvalRequest) {
        return res.status(404).json({ error: 'Approval request not found' });
      }

      // Check if user has permission to approve this request
      const canApprove = await this.canUserApproveRequest(req.user.id, approvalRequest);
      
      if (!canApprove) {
        return res.status(403).json({ 
          error: 'You are not authorized to approve this expense' 
        });
      }

      // Check if already approved by this user
      const existingAction = await db.get(
        'SELECT * FROM approval_actions WHERE approval_request_id = ? AND approver_id = ?',
        [approvalRequestId, req.user.id]
      );

      if (existingAction) {
        return res.status(400).json({ 
          error: 'You have already acted on this approval request' 
        });
      }

      // Check if request is still pending
      if (approvalRequest.status !== 'pending') {
        return res.status(400).json({ 
          error: 'This approval request is no longer pending' 
        });
      }

      // Record the approval action
      await db.run(
        `INSERT INTO approval_actions (approval_request_id, approver_id, action, comments, step_number)
         VALUES (?, ?, ?, ?, ?)`,
        [approvalRequestId, req.user.id, 'approve', comments, approvalRequest.current_step]
      );

      // Check if this approval satisfies the approval rule
      const isApproved = await this.checkApprovalConditions(approvalRequest, 'approve');

      if (isApproved) {
        // Mark approval request as approved
        await db.run(
          'UPDATE approval_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['approved', approvalRequestId]
        );

        // Mark expense as approved
        await db.run(
          'UPDATE expenses SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['approved', approvalRequest.expense_id]
        );

        console.log(`Expense approved: ID ${approvalRequest.expense_id} by ${req.user.email}`);

        res.json({
          message: 'Expense approved successfully',
          status: 'approved',
          expense_id: approvalRequest.expense_id
        });
      } else {
        // Move to next step or wait for more approvals
        const nextStep = await this.advanceApprovalStep(approvalRequest);

        console.log(`Expense approval recorded: ID ${approvalRequest.expense_id} by ${req.user.email}`);

        res.json({
          message: 'Approval recorded successfully',
          status: 'pending',
          next_step: nextStep,
          expense_id: approvalRequest.expense_id
        });
      }

    } catch (error) {
      console.error('Approve expense error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Reject expense
   */
  async rejectExpense(req, res) {
    try {
      const { approvalRequestId } = req.params;
      const { comments } = req.body;

      // Get approval request details
      const approvalRequest = await db.get(
        `SELECT ar.*, e.employee_id, e.company_id, u.name as employee_name
         FROM approval_requests ar
         JOIN expenses e ON ar.expense_id = e.id
         JOIN users u ON e.employee_id = u.id
         WHERE ar.id = ?`,
        [approvalRequestId]
      );

      if (!approvalRequest) {
        return res.status(404).json({ error: 'Approval request not found' });
      }

      // Check if user has permission to reject this request
      const canApprove = await this.canUserApproveRequest(req.user.id, approvalRequest);
      
      if (!canApprove) {
        return res.status(403).json({ 
          error: 'You are not authorized to reject this expense' 
        });
      }

      // Check if already acted on by this user
      const existingAction = await db.get(
        'SELECT * FROM approval_actions WHERE approval_request_id = ? AND approver_id = ?',
        [approvalRequestId, req.user.id]
      );

      if (existingAction) {
        return res.status(400).json({ 
          error: 'You have already acted on this approval request' 
        });
      }

      // Check if request is still pending
      if (approvalRequest.status !== 'pending') {
        return res.status(400).json({ 
          error: 'This approval request is no longer pending' 
        });
      }

      // Record the rejection action
      await db.run(
        `INSERT INTO approval_actions (approval_request_id, approver_id, action, comments, step_number)
         VALUES (?, ?, ?, ?, ?)`,
        [approvalRequestId, req.user.id, 'reject', comments || 'Rejected', approvalRequest.current_step]
      );

      // Mark approval request as rejected
      await db.run(
        'UPDATE approval_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['rejected', approvalRequestId]
      );

      // Mark expense as rejected
      await db.run(
        'UPDATE expenses SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['rejected', approvalRequest.expense_id]
      );

      console.log( `Expense rejected: ID ${approvalRequest.expense_id} by ${req.user.email}`);

      res.json({
        message: 'Expense rejected successfully',
        status: 'rejected',
        expense_id: approvalRequest.expense_id
      });

    } catch (error) {
      console.error('Reject expense error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Escalate expense
   */
  async escalateExpense(req, res) {
    try {
      const { approvalRequestId } = req.params;
      const { comments } = req.body;

      // Get approval request details
      const approvalRequest = await db.get(
        `SELECT ar.*, e.employee_id, e.company_id, u.name as employee_name
         FROM approval_requests ar
         JOIN expenses e ON ar.expense_id = e.id
         JOIN users u ON e.employee_id = u.id
         WHERE ar.id = ?`,
        [approvalRequestId]
      );

      if (!approvalRequest) {
        return res.status(404).json({ error: 'Approval request not found' });
      }

      // Only managers can escalate
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ 
          error: 'Only managers can escalate approval requests' 
        });
      }

      // Check if request is still pending
      if (approvalRequest.status !== 'pending') {
        return res.status(400).json({ 
          error: 'This approval request is no longer pending' 
        });
      }

      // Record the escalation action
      await db.run(
        `INSERT INTO approval_actions (approval_request_id, approver_id, action, comments, step_number)
         VALUES (?, ?, ?, ?, ?)`,
        [approvalRequestId, req.user.id, 'escalate', comments || 'Escalated for higher approval', approvalRequest.current_step]
      );

      // Mark approval request as escalated
      await db.run(
        'UPDATE approval_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['escalated', approvalRequestId]
      );

      // For now, escalated requests need admin intervention
      // In a more complex system, this could trigger assignment to senior managers

      console.log(`Expense escalated: ID ${approvalRequest.expense_id} by ${req.user.email}`);

      res.json({
        message: 'Expense escalated successfully',
        status: 'escalated',
        expense_id: approvalRequest.expense_id
      });

    } catch (error) {
      console.error('Escalate expense error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get approval request details
   */
  async getApprovalRequest(req, res) {
    try {
      const { approvalRequestId } = req.params;

      // Get approval request with full details
      const approvalRequest = await db.get(
        `SELECT ar., e., u.name as employee_name, m.name as manager_name,
                c.currency as company_currency, rule.name as rule_name,
                rule.rule_type, rule.percentage_threshold
         FROM approval_requests ar
         JOIN expenses e ON ar.expense_id = e.id
         JOIN users u ON e.employee_id = u.id
         LEFT JOIN users m ON u.manager_id = m.id
         JOIN companies c ON e.company_id = c.id
         JOIN approval_rules rule ON ar.approval_rule_id = rule.id
         WHERE ar.id = ? AND e.company_id = ?`,
        [approvalRequestId, req.user.company_id]
      );

      if (!approvalRequest) {
        return res.status(404).json({ error: 'Approval request not found' });
      }

      // Check if user has permission to view this request
      const canView = await this.canUserViewApprovalRequest(req.user, approvalRequest);
      
      if (!canView) {
        return res.status(403).json({ 
          error: 'You are not authorized to view this approval request' 
        });
      }

      // Get approval actions history
      const approvalActions = await db.all(
        `SELECT aa.*, u.name as approver_name, u.role as approver_role
         FROM approval_actions aa
         JOIN users u ON aa.approver_id = u.id
         WHERE aa.approval_request_id = ?
         ORDER BY aa.created_at ASC`,
        [approvalRequestId]
      );

      // Get required approvers
      const requiredApprovers = await this.getRequiredApprovers(approvalRequest);

      res.json({
        approval_request: {
          ...approvalRequest,
          has_receipt: !!approvalRequest.receipt_path
        },
        approval_actions: approvalActions,
        required_approvers: requiredApprovers
      });

    } catch (error) {
      console.error('Get approval request error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Check if user can approve a request
   * @private
   */
  async canUserApproveRequest(userId, approvalRequest) {
    try {
      // Admin can approve anything
      const user = await db.get('SELECT role FROM users WHERE id = ?', [userId]);
      if (user.role === 'admin') {
        return true;
      }

      // Check if user is in the approval sequence
      const sequence = await db.get(
        'SELECT * FROM approval_sequences WHERE approval_rule_id = ? AND approver_id = ?',
        [approvalRequest.approval_rule_id, userId]
      );

      if (sequence) {
        return true;
      }

      // Check if user is the employee's manager (for manager approver rules)
      const rule = await db.get('SELECT * FROM approval_rules WHERE id = ?', [approvalRequest.approval_rule_id]);
      
      if (rule.is_manager_approver) {
        const employee = await db.get('SELECT manager_id FROM users WHERE id = ?', [approvalRequest.employee_id]);
        if (employee && employee.manager_id === userId) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking approval permission:', error);
      return false;
    }
  }

  /**
   * Check if user can view an approval request
   * @private
   */
  async canUserViewApprovalRequest(user, approvalRequest) {
    try {
      // Admin can view all
      if (user.role === 'admin') {
        return true;
      }

      // Employee can view their own requests
      if (approvalRequest.employee_id === user.id) {
        return true;
      }

      // Managers can view their team's requests
      if (user.role === 'manager') {
        const employee = await db.get('SELECT manager_id FROM users WHERE id = ?', [approvalRequest.employee_id]);
        if (employee && employee.manager_id === user.id) {
          return true;
        }
      }

      // Check if user is in the approval chain
      const canApprove = await this.canUserApproveRequest(user.id, approvalRequest);
      return canApprove;

    } catch (error) {
      console.error('Error checking view permission:', error);
      return false;
    }
  }

  /**
   * Check if approval conditions are satisfied
   * @private
   */
  async checkApprovalConditions(approvalRequest, action) {
    try {
      const rule = await db.get('SELECT * FROM approval_rules WHERE id = ?', [approvalRequest.approval_rule_id]);

      // Get all approval actions for this request
      const actions = await db.all(
        'SELECT * FROM approval_actions WHERE approval_request_id = ?',
        [approvalRequest.id]
      );

      const approveActions = actions.filter(a => a.action === 'approve');
      const rejectActions = actions.filter(a => a.action === 'reject');

      // If any required approver rejects, the whole request is rejected
      if (rejectActions.length > 0) {
        const requiredRejecter = await db.get(
          'SELECT * FROM approval_sequences WHERE approval_rule_id = ? AND approver_id = ? AND is_required = 1',
          [rule.id, rejectActions[0].approver_id]
        );

        if (requiredRejecter) {
          return false; // Request should be rejected
        }
      }

      // Check rule-specific conditions
      switch (rule.rule_type) {
        case 'percentage':
          return await this.checkPercentageRule(rule, approvalRequest, approveActions);

        case 'specific_approver':
          return await this.checkSpecificApproverRule(rule, approveActions);

        case 'hybrid':
          const percentageResult = await this.checkPercentageRule(rule, approvalRequest, approveActions);
          const specificResult = await this.checkSpecificApproverRule(rule, approveActions);
          return percentageResult || specificResult; // Either condition can approve

        default:
          return false;
      }

    } catch (error) {
      console.error('Error checking approval conditions:', error);
      return false;
    }
  }

  /**
   * Check percentage rule
   * @private
   */
  async checkPercentageRule(rule, approvalRequest, approveActions) {
    try {
      // Get total number of approvers required
      const totalApprovers = await db.get(
        'SELECT COUNT(*) as count FROM approval_sequences WHERE approval_rule_id = ?',
        [rule.id]
      );

      // Include manager if required
      let requiredApprovers = totalApprovers.count;
      if (rule.is_manager_approver) {
        requiredApprovers += 1;
      }

      if (requiredApprovers === 0) {
        return false;
      }

      const approvalPercentage = (approveActions.length / requiredApprovers) * 100;
      return approvalPercentage >= rule.percentage_threshold;

    } catch (error) {
      console.error('Error checking percentage rule:', error);
      return false;
    }
  }

  /**
   * Check specific approver rule
   * @private
   */
  async checkSpecificApproverRule(rule, approveActions) {
    try {
      if (!rule.specific_approver_id) {
        return false;
      }

      return approveActions.some(action => action.approver_id === rule.specific_approver_id);

    } catch (error) {
      console.error('Error checking specific approver rule:', error);
      return false;
    }
  }

  /**
   * Advance approval to next step
   * @private
   */
  async advanceApprovalStep(approvalRequest) {
    try {
      const nextStep = approvalRequest.current_step + 1;
      
      // Update current step
      await db.run(
        'UPDATE approval_requests SET current_step = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [nextStep, approvalRequest.id]
      );

      return nextStep;
    } catch (error) {
      console.error('Error advancing approval step:', error);
      return approvalRequest.current_step;
    }
  }

  /**
   * Get required approvers for an approval request
   * @private
   */
  async getRequiredApprovers(approvalRequest) {
    try {
      const approvers = [];

      // Get approvers from sequence
      const sequenceApprovers = await db.all(
        `SELECT u.id, u.name, u.role, s.is_required, s.sequence_order
         FROM approval_sequences s
         JOIN users u ON s.approver_id = u.id
         WHERE s.approval_rule_id = ?
         ORDER BY s.sequence_order`,
        [approvalRequest.approval_rule_id]
      );

      approvers.push(...sequenceApprovers);

      // Add manager if required
      const rule = await db.get('SELECT * FROM approval_rules WHERE id = ?', [approvalRequest.approval_rule_id]);
      
      if (rule.is_manager_approver) {
        const employee = await db.get('SELECT manager_id FROM users WHERE id = ?', [approvalRequest.employee_id]);
        
        if (employee && employee.manager_id) {
          const manager = await db.get('SELECT id, name, role FROM users WHERE id = ?', [employee.manager_id]);
          
          if (manager) {
            approvers.unshift({
              ...manager,
              is_required: true,
              sequence_order: 0,
              is_manager: true
            });
          }
        }
      }

      return approvers;
    } catch (error) {
      console.error('Error getting required approvers:', error);
      return [];
    }
  }

  /**
   * Get approval statistics
   */
  async getApprovalStats(req, res) {
    try {
      // Only managers and admins can access this
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Manager or admin access required' });
      }

      let whereClause = 'WHERE e.company_id = ?';
      let queryParams = [req.user.company_id];

      // For managers, only show their team's statistics
      if (req.user.role === 'manager') {
        whereClause += ' AND u.manager_id = ?';
        queryParams.push(req.user.id);
      }

      // Get approval statistics
      const stats = await db.get(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN ar.status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN ar.status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN ar.status = 'rejected' THEN 1 ELSE 0 END) as rejected,
          SUM(CASE WHEN ar.status = 'escalated' THEN 1 ELSE 0 END) as escalated,
          AVG(CASE WHEN ar.status = 'approved' 
              THEN JULIANDAY(ar.updated_at) - JULIANDAY(ar.created_at) 
              ELSE NULL END) as avg_approval_days
        FROM approval_requests ar
        JOIN expenses e ON ar.expense_id = e.id
        JOIN users u ON e.employee_id = u.id
        ${whereClause}
      `, queryParams);

      // Get pending requests by age
      const pendingByAge = await db.all(`
        SELECT 
          CASE 
            WHEN JULIANDAY('now') - JULIANDAY(ar.created_at) <= 1 THEN '0-1 days'
            WHEN JULIANDAY('now') - JULIANDAY(ar.created_at) <= 3 THEN '1-3 days'
            WHEN JULIANDAY('now') - JULIANDAY(ar.created_at) <= 7 THEN '3-7 days'
            ELSE '7+ days'
          END as age_range,
          COUNT(*) as count
        FROM approval_requests ar
        JOIN expenses e ON ar.expense_id = e.id
        JOIN users u ON e.employee_id = u.id
        ${whereClause} AND ar.status = 'pending'
        GROUP BY age_range
      `, queryParams);

      res.json({
        statistics: {
          ...stats,
          avg_approval_days: stats.avg_approval_days ? Math.round(stats.avg_approval_days * 10) / 10 : 0
        },
        pending_by_age: pendingByAge
      });

    } catch (error) {
      console.error('Get approval stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = new ApprovalController();