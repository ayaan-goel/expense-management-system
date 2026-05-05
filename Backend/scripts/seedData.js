const Database = require('sqlite3').Database;
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.sqlite');

async function seedDatabase() {
  const db = new Database(DB_PATH);

  try {
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    console.log('🌱 Starting database seeding...');

    // Clear existing data in order (respecting foreign keys)
    const clearTables = [
      'approval_actions',
      'approval_requests', 
      'approval_sequences',
      'approval_rules',
      'ocr_results',
      'expenses',
      'exchange_rates',
      'users',
      'companies'
    ];

    for (const table of clearTables) {
      await runQuery(db, `DELETE FROM ${table}`);
      console.log(`✅ Cleared ${table} table`);
    }

    // 1. Create Demo Company
    const companyId = await runQuery(db, 
      `INSERT INTO companies (name, currency, timezone, created_at) 
       VALUES (?, ?, ?, datetime('now'))`,
      ['TechCorp Inc.', 'USD', 'America/New_York']
    );
    console.log('✅ Created demo company: TechCorp Inc.');

    // 2. Create Users
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    // Admin user
    const adminId = await runQuery(db,
      `INSERT INTO users (company_id, name, email, password_hash, role, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [companyId.lastID, 'Alice Admin', 'admin@techcorp.com', hashedPassword, 'admin', 1]
    );

    // Manager user
    const managerId = await runQuery(db,
      `INSERT INTO users (company_id, name, email, password_hash, role, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [companyId.lastID, 'Bob Manager', 'manager@techcorp.com', hashedPassword, 'manager', 1]
    );

    // Employee users
    const employee1Id = await runQuery(db,
      `INSERT INTO users (company_id, name, email, password_hash, role, manager_id, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [companyId.lastID, 'Charlie Employee', 'charlie@techcorp.com', hashedPassword, 'employee', managerId.lastID, 1]
    );

    const employee2Id = await runQuery(db,
      `INSERT INTO users (company_id, name, email, password_hash, role, manager_id, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [companyId.lastID, 'Diana Employee', 'diana@techcorp.com', hashedPassword, 'employee', managerId.lastID, 1]
    );

    console.log('✅ Created users: Admin, Manager, and 2 Employees');

    // 3. Create Approval Rules
    const rule1Id = await runQuery(db,
      `INSERT INTO approval_rules (company_id, rule_type, rule_name, conditions, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [companyId.lastID, 'percentage', 'Small Expenses Auto-Approve', JSON.stringify({threshold: 50}), adminId.lastID]
    );

    const rule2Id = await runQuery(db,
      `INSERT INTO approval_rules (company_id, rule_type, rule_name, conditions, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [companyId.lastID, 'specific_approver', 'Manager Approval Required', JSON.stringify({approver_id: managerId.lastID, threshold: 51}), adminId.lastID]
    );

    const rule3Id = await runQuery(db,
      `INSERT INTO approval_rules (company_id, rule_type, rule_name, conditions, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [companyId.lastID, 'hybrid', 'Admin Approval for Large Expenses', JSON.stringify({threshold: 200, approver_id: adminId.lastID}), adminId.lastID]
    );

    console.log('✅ Created approval rules: Auto-approve, Manager, Admin');

    // 4. Create Approval Sequence
    const sequenceId = await runQuery(db,
      `INSERT INTO approval_sequences (company_id, sequence_name, rules, is_active, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [companyId.lastID, 'Standard Approval Flow', JSON.stringify([rule1Id.lastID, rule2Id.lastID, rule3Id.lastID]), 1, adminId.lastID]
    );

    console.log('✅ Created approval sequence: Standard Approval Flow');

    // 5. Create Sample Exchange Rate
    await runQuery(db,
      `INSERT INTO exchange_rates (from_currency, to_currency, rate, cached_at)
       VALUES (?, ?, ?, datetime('now'))`,
      ['EUR', 'USD', 1.08]
    );

    // 6. Create Sample Expenses in Different States

    // Draft expense (Employee 1)
    const expense1Id = await runQuery(db,
      `INSERT INTO expenses (company_id, user_id, title, description, amount, original_currency, 
                            converted_amount, converted_currency, category, status, expense_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [companyId.lastID, employee1Id.lastID, 'Office Supplies', 'Pens and notebooks for team', 
       25.99, 'USD', 25.99, 'USD', 'office_supplies', 'draft', '2024-12-01']
    );

    // Submitted expense waiting approval (Employee 1)
    const expense2Id = await runQuery(db,
      `INSERT INTO expenses (company_id, user_id, title, description, amount, original_currency, 
                            converted_amount, converted_currency, category, status, expense_date, 
                            submitted_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [companyId.lastID, employee1Id.lastID, 'Business Lunch', 'Client meeting at Downtown Restaurant', 
       75.50, 'USD', 75.50, 'USD', 'meals', 'waiting_approval', '2024-12-02']
    );

    // Create approval request for expense2
    const approvalRequest1Id = await runQuery(db,
      `INSERT INTO approval_requests (expense_id, sequence_id, current_step, status, 
                                     current_approver_id, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [expense2Id.lastID, sequenceId.lastID, 2, 'pending', managerId.lastID]
    );

    // Approved expense (Employee 2)
    const expense3Id = await runQuery(db,
      `INSERT INTO expenses (company_id, user_id, title, description, amount, original_currency, 
                            converted_amount, converted_currency, category, status, expense_date, 
                            submitted_at, approved_at, approved_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'), 
               datetime('now', '-1 day'), ?, datetime('now', '-3 days'))`,
      [companyId.lastID, employee2Id.lastID, 'Software License', 'Annual Figma subscription', 
       144.00, 'USD', 144.00, 'USD', 'software', 'approved', '2024-11-28', managerId.lastID]
    );

    // Create completed approval request for expense3
    const approvalRequest2Id = await runQuery(db,
      `INSERT INTO approval_requests (expense_id, sequence_id, current_step, status, 
                                     current_approver_id, completed_at, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', '-1 day'), datetime('now', '-2 days'))`,
      [expense3Id.lastID, sequenceId.lastID, 2, 'approved', managerId.lastID]
    );

    // Add approval action for expense3
    await runQuery(db,
      `INSERT INTO approval_actions (request_id, approver_id, action, comments, created_at)
       VALUES (?, ?, ?, ?, datetime('now', '-1 day'))`,
      [approvalRequest2Id.lastID, managerId.lastID, 'approve', 'Standard software expense, approved.']
    );

    // Rejected expense (Employee 2)
    const expense4Id = await runQuery(db,
      `INSERT INTO expenses (company_id, user_id, title, description, amount, original_currency, 
                            converted_amount, converted_currency, category, status, expense_date, 
                            submitted_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 day'), datetime('now', '-2 days'))`,
      [companyId.lastID, employee2Id.lastID, 'Personal Item', 'Coffee machine for personal use', 
       299.99, 'USD', 299.99, 'USD', 'equipment', 'rejected', '2024-11-29']
    );

    // Create rejected approval request for expense4
    const approvalRequest3Id = await runQuery(db,
      `INSERT INTO approval_requests (expense_id, sequence_id, current_step, status, 
                                     current_approver_id, completed_at, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', '-1 day'), datetime('now', '-1 day'))`,
      [expense4Id.lastID, sequenceId.lastID, 3, 'rejected', adminId.lastID]
    );

    // Add rejection action for expense4
    await runQuery(db,
      `INSERT INTO approval_actions (request_id, approver_id, action, comments, created_at)
       VALUES (?, ?, ?, ?, datetime('now', '-1 day'))`,
      [approvalRequest3Id.lastID, adminId.lastID, 'reject', 'This appears to be a personal expense. Please ensure all submitted expenses are business-related.']
    );

    // Large expense requiring admin approval (Employee 1)
    const expense5Id = await runQuery(db,
      `INSERT INTO expenses (company_id, user_id, title, description, amount, original_currency, 
                            converted_amount, converted_currency, category, status, expense_date, 
                            submitted_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [companyId.lastID, employee1Id.lastID, 'Conference Registration', 'Tech Summit 2024 registration and flight', 
       850.00, 'USD', 850.00, 'USD', 'travel', 'waiting_approval', '2024-12-03']
    );

    // Create approval request for large expense
    const approvalRequest4Id = await runQuery(db,
      `INSERT INTO approval_requests (expense_id, sequence_id, current_step, status, 
                                     current_approver_id, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [expense5Id.lastID, sequenceId.lastID, 3, 'pending', adminId.lastID]
    );

    console.log('✅ Created sample expenses in various states (draft, waiting, approved, rejected)');

    // 7. Create Sample OCR Results
    const ocrResult1Id = await runQuery(db,
      `INSERT INTO ocr_results (company_id, user_id, original_filename, file_path, 
                               raw_text, parsed_data, confidence_score, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [companyId.lastID, employee1Id.lastID, 'receipt_123.jpg', '/uploads/receipts/receipt_123.jpg',
       'ACME Store\n123 Main St\nDate: 12/01/2024\nOffice supplies: $15.99\nPens: $9.99\nTotal: $25.98\nThank you!',
       JSON.stringify({
         vendor: 'ACME Store',
         amount: 25.98,
         date: '2024-12-01',
         line_items: [
           {item: 'Office supplies', amount: 15.99},
           {item: 'Pens', amount: 9.99}
         ],
         category: 'office_supplies'
       }),
       85.5, 'completed']
    );

    console.log('✅ Created sample OCR result');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary of seeded data:');
    console.log('• 1 Company: TechCorp Inc.');
    console.log('• 4 Users: 1 Admin, 1 Manager, 2 Employees');
    console.log('• 3 Approval Rules: Auto-approve, Manager, Admin');
    console.log('• 1 Approval Sequence: Standard Approval Flow');
    console.log('• 5 Sample Expenses: Draft, Waiting, Approved, Rejected, Large');
    console.log('• 4 Approval Requests: Various states');
    console.log('• 1 Sample OCR Result');
    console.log('\n🔐 Login Credentials (password: password123):');
    console.log('• Admin: admin@techcorp.com');
    console.log('• Manager: manager@techcorp.com');
    console.log('• Employee 1: charlie@techcorp.com');
    console.log('• Employee 2: diana@techcorp.com');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Utility function to promisify database operations
function runQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

// Run seeding if called directly
if (require.main === module) {
  seedDatabase().catch(error => {
    console.error('Failed to seed database:', error);
    process.exit(1);
  });
}

module.exports = { seedDatabase };