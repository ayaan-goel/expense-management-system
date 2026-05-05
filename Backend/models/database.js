const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = new sqlite3.Database('expense_tracker.db');
    this.init();
  }

  init() {
    // Create tables in order of dependencies
    this.createTables();
  }

  createTables() {
    const queries = [
      // Companies table
      `CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        country_code TEXT,
        currency TEXT NOT NULL DEFAULT 'USD',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
        manager_id INTEGER,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies (id),
        FOREIGN KEY (manager_id) REFERENCES users (id)
      )`,

      // Approval Rules table
      `CREATE TABLE IF NOT EXISTS approval_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        rule_type TEXT NOT NULL CHECK (rule_type IN ('percentage', 'specific_approver', 'hybrid')),
        percentage_threshold DECIMAL(5,2),
        specific_approver_id INTEGER,
        is_manager_approver BOOLEAN DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies (id),
        FOREIGN KEY (specific_approver_id) REFERENCES users (id)
      )`,

      // Approval Sequences table
      `CREATE TABLE IF NOT EXISTS approval_sequences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        approval_rule_id INTEGER NOT NULL,
        approver_id INTEGER NOT NULL,
        sequence_order INTEGER NOT NULL,
        is_required BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (approval_rule_id) REFERENCES approval_rules (id),
        FOREIGN KEY (approver_id) REFERENCES users (id),
        UNIQUE(approval_rule_id, sequence_order)
      )`,

      // Expenses table
      `CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        amount_in_company_currency DECIMAL(10,2),
        exchange_rate DECIMAL(10,6) DEFAULT 1.0,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        expense_date DATE NOT NULL,
        receipt_path TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'waiting_approval', 'approved', 'rejected')),
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies (id),
        FOREIGN KEY (employee_id) REFERENCES users (id)
      )`,

      // Approval Requests table
      `CREATE TABLE IF NOT EXISTS approval_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER NOT NULL,
        approval_rule_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'escalated')),
        current_step INTEGER DEFAULT 1,
        total_steps INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (expense_id) REFERENCES expenses (id),
        FOREIGN KEY (approval_rule_id) REFERENCES approval_rules (id)
      )`,

      // Approval Actions table
      `CREATE TABLE IF NOT EXISTS approval_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        approval_request_id INTEGER NOT NULL,
        approver_id INTEGER NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'escalate')),
        comments TEXT,
        step_number INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (approval_request_id) REFERENCES approval_requests (id),
        FOREIGN KEY (approver_id) REFERENCES users (id)
      )`,

      `CREATE TABLE IF NOT EXISTS ocr_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER,
        file_path TEXT NOT NULL,
        parsed_fields JSON NOT NULL,
        confidence_score DECIMAL(5,2),
        processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'completed', 'failed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (expense_id) REFERENCES expenses (id)
      )`,

      `CREATE TABLE IF NOT EXISTS exchange_rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        base_currency TEXT NOT NULL,
        target_currency TEXT NOT NULL,
        rate DECIMAL(10,6) NOT NULL,
        cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        UNIQUE(base_currency, target_currency)
      )`,

      `CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id)`,
      `CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id)`,
      `CREATE INDEX IF NOT EXISTS idx_expenses_employee_id ON expenses(employee_id)`,
      `CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status)`,
      `CREATE INDEX IF NOT EXISTS idx_approval_requests_expense_id ON approval_requests(expense_id)`,
      `CREATE INDEX IF NOT EXISTS idx_approval_actions_approval_request_id ON approval_actions(approval_request_id)`,
      `CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies ON exchange_rates(base_currency, target_currency)`
    ];

    queries.forEach((query) => {
      this.db.run(query, (err) => {
        if (err) {
          console.error('Error creating table:', err.message);
        }
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

const db = new Database();
module.exports = db;