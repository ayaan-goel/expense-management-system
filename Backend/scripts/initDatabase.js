const Database = require('sqlite3').Database;
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.sqlite');

function initializeDatabase() {
  const db = new Database(DB_PATH);

  console.log(' Initializing database...');

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON');

      // Companies table
      db.run(`
        CREATE TABLE IF NOT EXISTS companies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          currency TEXT NOT NULL DEFAULT 'USD',
          timezone TEXT DEFAULT 'UTC',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('Error creating companies table:', err);
        else console.log('✅ Created companies table');
      });

      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
          manager_id INTEGER,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies (id),
          FOREIGN KEY (manager_id) REFERENCES users (id)
        )
      `, (err) => {
        if (err) console.error('Error creating users table:', err);
        else console.log('✅ Created users table');
      });

      // Approval Rules table
      db.run(`
        CREATE TABLE IF NOT EXISTS approval_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER NOT NULL,
          rule_type TEXT NOT NULL CHECK (rule_type IN ('percentage', 'specific_approver', 'hybrid')),
          rule_name TEXT NOT NULL,
          conditions TEXT NOT NULL, -- JSON string with rule conditions
          is_active BOOLEAN DEFAULT 1,
          created_by INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies (id),
          FOREIGN KEY (created_by) REFERENCES users (id)
        )
      `, (err) => {
        if (err) console.error('Error creating approval_rules table:', err);
        else console.log('✅ Created approval_rules table');
      });

      // Approval Sequences table
      db.run(`
        CREATE TABLE IF NOT EXISTS approval_sequences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER NOT NULL,
          sequence_name TEXT NOT NULL,
          rules TEXT NOT NULL, -- JSON array of rule IDs in order
          is_active BOOLEAN DEFAULT 1,
          created_by INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies (id),
          FOREIGN KEY (created_by) REFERENCES users (id)
        )
      `, (err) => {
        if (err) console.error('Error creating approval_sequences table:', err);
        else console.log('✅ Created approval_sequences table');
      });

      // Expenses table
      db.run(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          amount DECIMAL(10,2) NOT NULL,
          original_currency TEXT NOT NULL DEFAULT 'USD',
          converted_amount DECIMAL(10,2),
          converted_currency TEXT,
          exchange_rate DECIMAL(10,6) DEFAULT 1.0,
          category TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'waiting_approval', 'approved', 'rejected', 'cancelled')),
          expense_date DATE NOT NULL,
          attachment_path TEXT,
          submitted_at DATETIME,
          approved_at DATETIME,
          approved_by INTEGER,
          rejected_at DATETIME,
          rejected_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies (id),
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (approved_by) REFERENCES users (id),
          FOREIGN KEY (rejected_by) REFERENCES users (id)
        )
      `, (err) => {
        if (err) console.error('Error creating expenses table:', err);
        else console.log('✅ Created expenses table');
      });

      // Approval Requests table
      db.run(`
        CREATE TABLE IF NOT EXISTS approval_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          expense_id INTEGER NOT NULL,
          sequence_id INTEGER NOT NULL,
          current_step INTEGER DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'escalated')),
          current_approver_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          FOREIGN KEY (expense_id) REFERENCES expenses (id),
          FOREIGN KEY (sequence_id) REFERENCES approval_sequences (id),
          FOREIGN KEY (current_approver_id) REFERENCES users (id)
        )
      `, (err) => {
        if (err) console.error('Error creating approval_requests table:', err);
        else console.log('✅ Created approval_requests table');
      });

      // Approval Actions table
      db.run(`
        CREATE TABLE IF NOT EXISTS approval_actions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          request_id INTEGER NOT NULL,
          approver_id INTEGER NOT NULL,
          action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'escalate')),
          comments TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (request_id) REFERENCES approval_requests (id),
          FOREIGN KEY (approver_id) REFERENCES users (id)
        )
      `, (err) => {
        if (err) console.error('Error creating approval_actions table:', err);
        else console.log('✅ Created approval_actions table');
      });

      // OCR Results table
      db.run(`
        CREATE TABLE IF NOT EXISTS ocr_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          original_filename TEXT NOT NULL,
          file_path TEXT NOT NULL,
          raw_text TEXT,
          parsed_data TEXT, -- JSON string with parsed fields
          confidence_score DECIMAL(5,2),
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          processed_at DATETIME,
          FOREIGN KEY (company_id) REFERENCES companies (id),
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `, (err) => {
        if (err) console.error('Error creating ocr_results table:', err);
        else console.log('✅ Created ocr_results table');
      });

      // Exchange Rates table
      db.run(`
        CREATE TABLE IF NOT EXISTS exchange_rates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          from_currency TEXT NOT NULL,
          to_currency TEXT NOT NULL,
          rate DECIMAL(10,6) NOT NULL,
          cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(from_currency, to_currency)
        )
      `, (err) => {
        if (err) console.error('Error creating exchange_rates table:', err);
        else console.log('✅ Created exchange_rates table');
      });

      // Create indexes for better performance
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id)',
        'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
        'CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id)',
        'CREATE INDEX IF NOT EXISTS idx_expenses_company_id ON expenses(company_id)',
        'CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status)',
        'CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date)',
        'CREATE INDEX IF NOT EXISTS idx_approval_requests_expense_id ON approval_requests(expense_id)',
        'CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status)',
        'CREATE INDEX IF NOT EXISTS idx_approval_requests_current_approver_id ON approval_requests(current_approver_id)',
        'CREATE INDEX IF NOT EXISTS idx_approval_actions_request_id ON approval_actions(request_id)',
        'CREATE INDEX IF NOT EXISTS idx_approval_actions_approver_id ON approval_actions(approver_id)',
        'CREATE INDEX IF NOT EXISTS idx_ocr_results_company_id ON ocr_results(company_id)',
        'CREATE INDEX IF NOT EXISTS idx_ocr_results_user_id ON ocr_results(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_ocr_results_status ON ocr_results(status)',
        'CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies ON exchange_rates(from_currency, to_currency)'
      ];

      indexes.forEach((indexSql, i) => {
        db.run(indexSql, (err) => {
          if (err) console.error(`Error creating index ${i + 1}:`, err);
          else if (i === 0) console.log('✅ Created database indexes');
        });
      });

      db.run('PRAGMA optimize', (err) => {
        if (err) console.error('Error running PRAGMA optimize:', err);

        console.log('\n🎉 Database initialization completed successfully!');
        console.log('\n📋 Created tables:');
        console.log('• companies - Organization data');
        console.log('• users - User accounts with roles');
        console.log('• approval_rules - Configurable approval conditions');
        console.log('• approval_sequences - Ordered approval workflows');
        console.log('• expenses - Expense records');
        console.log('• approval_requests - Active approval processes');
        console.log('• approval_actions - History of approval decisions');
        console.log('• ocr_results - OCR processing results');
        console.log('• exchange_rates - Currency conversion cache');
        console.log('\n💡 Next step: Run "npm run seed" to populate with demo data');
        
        db.close((closeErr) => {
          if (closeErr) reject(closeErr);
          else resolve();
        });
      });
    });
  });
}

// Run initialization if called directly
if (require.main === module) {
  initializeDatabase().catch(error => {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  });
}

module.exports = { initializeDatabase };