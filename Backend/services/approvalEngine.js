const Database = require('sqlite3').Database;
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.sqlite');

class ApprovalEngine {
  /**
   * Process expense through approval workflow
   */
  async processExpenseApproval(expenseId) {
    const expense = await this.getExpense(expenseId);
    if (!expense) {
      throw new Error('Expense not found');
    }

    // Get active approval sequence for company
    const sequence = await this.getActiveSequence(expense.company_id);
    if (!sequence) {
      // No approval sequence - auto approve
      await this.updateExpenseStatus(expenseId, 'approved');
      return { status: 'approved', message: 'Auto-approved (no approval sequence)' };
    }

    // Parse sequence rules
    const rules = JSON.parse(sequence.rules);
    
    // Evaluate rules in order
    for (let i = 0; i < rules.length; i++) {
      const rule = await this.getRule(rules[i]);
      if (!rule) continue;

      const ruleResult = await this.evaluateRule(rule, expense);
      
      if (ruleResult.action === 'approve') {
        await this.updateExpenseStatus(expenseId, 'approved', rule.id);
        return { status: 'approved', message: `Auto-approved by rule: ${rule.rule_name}` };
      } else if (ruleResult.action === 'require_approval') {
        // Create approval request
        const requestId = await this.createApprovalRequest(
          expenseId, 
          sequence.id, 
          i + 1, 
          ruleResult.approver_id
        );
        
        await this.updateExpenseStatus(expenseId, 'waiting_approval');
        
        return { 
          status: 'waiting_approval', 
          message: `Requires approval from ${ruleResult.approver_name}`,
          requestId,
          approverId: ruleResult.approver_id
        };
      }
    }

    // If no rules match, default to requiring manager approval
    const managerApproval = await this.createManagerApprovalRequest(expense);
    return managerApproval;
  }

  /**
   * Evaluate a specific approval rule
   */
  async evaluateRule(rule, expense) {
    const conditions = JSON.parse(rule.conditions);
    
    switch (rule.rule_type) {
      case 'percentage':
        return this.evaluatePercentageRule(conditions, expense);
      
      case 'specific_approver':
        return this.evaluateSpecificApproverRule(conditions, expense);
      
      case 'hybrid':
        return this.evaluateHybridRule(conditions, expense);
      
      default:
        throw new Error(`Unknown rule type: ${rule.rule_type}`);
    }
  }

  /**
   * Evaluate percentage-based rule
   */
  async evaluatePercentageRule(conditions, expense) {
    const threshold = conditions.threshold || 0;
    
    if (expense.amount <= threshold) {
      return { action: 'approve' };
    }
    
    return { action: 'continue' }; // Continue to next rule
  }

  /**
   * Evaluate specific approver rule
   */
  async evaluateSpecificApproverRule(conditions, expense) {
    const threshold = conditions.threshold || 0;
    const approverId = conditions.approver_id;
    
    if (expense.amount > threshold) {
      const approver = await this.getUser(approverId);
      return {
        action: 'require_approval',
        approver_id: approverId,
        approver_name: approver ? approver.name : 'Unknown Approver'
      };
    }
    
    return { action: 'continue' };
  }

  /**
   * Evaluate hybrid rule (combination of percentage and specific approver)
   */
  async evaluateHybridRule(conditions, expense) {
    const threshold = conditions.threshold || 0;
    const approverId = conditions.approver_id;
    
    if (expense.amount <= threshold) {
      return { action: 'approve' };
    } else if (approverId) {
      const approver = await this.getUser(approverId);
      return {
        action: 'require_approval',
        approver_id: approverId,
        approver_name: approver ? approver.name : 'Unknown Approver'
      };
    }
    
    return { action: 'continue' };
  }

  /**
   * Create manager approval request as fallback
   */
  async createManagerApprovalRequest(expense) {
    const employee = await this.getUser(expense.user_id);
    
    if (employee && employee.manager_id) {
      const sequence = await this.getOrCreateDefaultSequence(expense.company_id);
      
      const requestId = await this.createApprovalRequest(
        expense.id,
        sequence.id,
        1,
        employee.manager_id
      );
      
      await this.updateExpenseStatus(expense.id, 'waiting_approval');
      
      const manager = await this.getUser(employee.manager_id);
      
      return {
        status: 'waiting_approval',
        message: `Requires manager approval`,
        requestId,
        approverId: employee.manager_id,
        approverName: manager ? manager.name : 'Manager'
      };
    }
    
    // No manager found, auto-approve
    await this.updateExpenseStatus(expense.id, 'approved');
    return { status: 'approved', message: 'Auto-approved (no manager found)' };
  }

  /**
   * Process approval action
   */
  async processApprovalAction(requestId, approverId, action, comments = null) {
    const request = await this.getApprovalRequest(requestId);
    if (!request) {
      throw new Error('Approval request not found');
    }

    // Verify approver permission
    if (request.current_approver_id !== approverId) {
      throw new Error('Not authorized to approve this request');
    }

    // Record the action
    await this.recordApprovalAction(requestId, approverId, action, comments);

    if (action === 'approve') {
      // Update expense status
      await this.updateExpenseStatus(request.expense_id, 'approved', approverId);
      await this.completeApprovalRequest(requestId, 'approved');
      
      return { status: 'approved', message: 'Expense approved' };
    } else if (action === 'reject') {
      // Update expense status
      await this.updateExpenseStatus(request.expense_id, 'rejected', approverId);
      await this.completeApprovalRequest(requestId, 'rejected');
      
      return { status: 'rejected', message: 'Expense rejected' };
    } else if (action === 'escalate') {
      // Find next approver (could be admin or higher level)
      const nextApprover = await this.findEscalationApprover(request);
      
      if (nextApprover) {
        await this.updateApprovalRequestApprover(requestId, nextApprover.id);
        return { 
          status: 'escalated', 
          message: `Escalated to ${nextApprover.name}`,
          nextApproverId: nextApprover.id
        };
      } else {
        // No one to escalate to, auto-approve
        await this.updateExpenseStatus(request.expense_id, 'approved');
        await this.completeApprovalRequest(requestId, 'approved');
        
        return { status: 'approved', message: 'Auto-approved (no escalation target)' };
      }
    }
    
    throw new Error(`Unknown action: ${action}`);
  }

  /**
   * Find appropriate escalation approver
   */
  async findEscalationApprover(request) {
    // Get expense details
    const expense = await this.getExpense(request.expense_id);
    if (!expense) return null;

    // Find admin users in the company
    const admins = await this.getCompanyAdmins(expense.company_id);
    if (admins.length > 0) {
      return admins[0]; // Return first admin
    }

    return null;
  }

  // Database helper methods
  
  getExpense(expenseId) {
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH);
      db.get('SELECT * FROM expenses WHERE id = ?', [expenseId], (err, row) => {
        db.close();
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  getActiveSequence(companyId) {
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH);
      db.get(
        'SELECT * FROM approval_sequences WHERE company_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1',
        [companyId],
        (err, row) => {
          db.close();
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  getRule(ruleId) {
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH);
      db.get('SELECT * FROM approval_rules WHERE id = ? AND is_active = 1', [ruleId], (err, row) => {
        db.close();
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  getUser(userId) {
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH);
      db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
        db.close();
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  getCompanyAdmins(companyId) {
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH);
      db.all(
        'SELECT * FROM users WHERE company_id = ? AND role = ? AND is_active = 1',
        [companyId, 'admin'],
        (err, rows) => {
          db.close();
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  createApprovalRequest(expenseId, sequenceId, step, approverId) {
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH);
      
      const sql = `
        INSERT INTO approval_requests (expense_id, sequence_id, current_step, current_approver_id, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `;
      
      db.run(sql, [expenseId, sequenceId, step, approverId], function(err) {
        db.close();
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  updateExpenseStatus(expenseId, status, approverId = null) {
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH);
      
      let sql, params;
      
      if (status === 'approved') {
        sql = 'UPDATE expenses SET status = ?, approved_at = datetime(\'now\'), approved_by = ? WHERE id = ?';
        params = [status, approverId, expenseId];
      } else if (status === 'rejected') {
        sql = 'UPDATE expenses SET status = ?, rejected_at = datetime(\'now\'), rejected_by = ? WHERE id = ?';
        params = [status, approverId, expenseId];
      } else {
        sql = 'UPDATE expenses SET status = ? WHERE id = ?';
        params = [status, expenseId];
      }
      
      db.run(sql, params, function(err) {
        db.close();
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  recordApprovalAction(requestId, approverId, action, comments) {
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH);
      
      const sql = `
        INSERT INTO approval_actions (request_id, approver_id, action, comments, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `;
      
      db.run(sql, [requestId, approverId, action, comments], function(err) {
        db.close();
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  getApprovalRequest(requestId) {
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH);
      db.get('SELECT * FROM approval_requests WHERE id = ?', [requestId], (err, row) => {
        db.close();
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  completeApprovalRequest(requestId, status) {
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH);
      
      const sql = 'UPDATE approval_requests SET status = ?, completed_at = datetime(\'now\') WHERE id = ?';
      
      db.run(sql, [status, requestId], function(err) {
        db.close();
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  updateApprovalRequestApprover(requestId, newApproverId) {
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH);
      
      const sql = 'UPDATE approval_requests SET current_approver_id = ? WHERE id = ?';
      
      db.run(sql, [newApproverId, requestId], function(err) {
        db.close();
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async getOrCreateDefaultSequence(companyId) {
    let sequence = await this.getActiveSequence(companyId);
    
    if (!sequence) {
      // Create a basic default sequence (manager approval)
      const db = new Database(DB_PATH);
      
      return new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO approval_sequences (company_id, sequence_name, rules, is_active, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `;
        
        const defaultRules = JSON.stringify([]); // Empty rules array
        
        db.run(sql, [companyId, 'Default Sequence', defaultRules, 1, 1], function(err) {
          db.close();
          if (err) reject(err);
          else resolve({ id: this.lastID });
        });
      });
    }
    
    return sequence;
  }
}

module.exports = new ApprovalEngine();