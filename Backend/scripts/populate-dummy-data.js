const bcrypt = require('bcrypt');
const db = require('../models/database');

// Dummy data generator
const generateDummyData = async () => {
  try {
    console.log('🚀 Starting to populate database with dummy data...\n');

    // Clear existing data (optional - uncomment if you want to start fresh)
    await clearAllData();

    // Step 1: Create Companies
    console.log('📊 Creating companies...');
    const companies = await createCompanies();
    console.log(`✅ Created ${companies.length} companies\n`);

    // Step 2: Create Users (Admin, Managers, Employees)
    console.log('👥 Creating users...');
    const users = await createUsers(companies[0].id);
    console.log(`✅ Created ${users.length} users\n`);

    // Step 3: Create Approval Rules
    console.log('📋 Creating approval rules...');
    const approvalRules = await createApprovalRules(companies[0].id, users);
    console.log(`✅ Created ${approvalRules.length} approval rules\n`);

    // Step 4: Create Approval Sequences
    console.log('🔄 Creating approval sequences...');
    const sequences = await createApprovalSequences(approvalRules, users);
    console.log(`✅ Created ${sequences.length} approval sequences\n`);

    // Step 5: Create Expenses
    console.log('💰 Creating expenses...');
    const expenses = await createExpenses(companies[0].id, users);
    console.log(`✅ Created ${expenses.length} expenses\n`);

    // Step 6: Create Approval Requests
    console.log('📝 Creating approval requests...');
    const approvalRequests = await createApprovalRequests(expenses, approvalRules);
    console.log(`✅ Created ${approvalRequests.length} approval requests\n`);

    // Step 7: Create Approval Actions
    console.log('⚡ Creating approval actions...');
    const actions = await createApprovalActions(approvalRequests, users);
    console.log(`✅ Created ${actions.length} approval actions\n`);

    // Step 8: Create Exchange Rates
    console.log('💱 Creating exchange rates...');
    const rates = await createExchangeRates();
    console.log(`✅ Created ${rates.length} exchange rates\n`);

    // Step 9: Create OCR Results
    console.log('🔍 Creating OCR results...');
    const ocrResults = await createOCRResults(expenses);
    console.log(`✅ Created ${ocrResults.length} OCR results\n`);

    // Display summary
    await displayDataSummary();

    console.log('🎉 Database populated successfully with dummy data!');
    console.log('\n📋 Test Credentials:');
    console.log('Admin: admin@techcorp.com / password123');
    console.log('Manager: john.manager@techcorp.com / password123');
    console.log('Employee: alice.employee@techcorp.com / password123');
    console.log('Employee: bob.employee@techcorp.com / password123');

  } catch (error) {
    console.error('❌ Error populating database:', error);
  }
};

// Clear all data (use with caution)
const clearAllData = async () => {
  const tables = [
    'approval_actions',
    'approval_requests', 
    'ocr_results',
    'expenses',
    'approval_sequences',
    'approval_rules',
    'users',
    'companies',
    'exchange_rates'
  ];

  for (const table of tables) {
    await db.run(`DELETE FROM ${table}`);
    console.log(`🗑️ Cleared ${table} table`);
  }
};

// Create Companies
const createCompanies = async () => {
  const companies = [
    { name: 'TechCorp Solutions', country_code: 'US', currency: 'USD' },
    { name: 'Global Innovations Ltd', country_code: 'UK', currency: 'GBP' },
    { name: 'Digital Dynamics Inc', country_code: 'CA', currency: 'CAD' }
  ];

  const results = [];
  for (const company of companies) {
    const result = await db.run(
      'INSERT INTO companies (name, country_code, currency) VALUES (?, ?, ?)',
      [company.name, company.country_code, company.currency]
    );
    results.push({ id: result.id, ...company });
  }
  return results;
};

// Create Users
const createUsers = async (companyId) => {
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash('password123', saltRounds);

  const users = [
    {
      name: 'Admin User',
      email: 'admin@techcorp.com',
      role: 'admin',
      manager_id: null
    },
    {
      name: 'John Manager',
      email: 'john.manager@techcorp.com',
      role: 'manager',
      manager_id: null // Will be set to admin after creation
    },
    {
      name: 'Sarah Manager',
      email: 'sarah.manager@techcorp.com',
      role: 'manager',
      manager_id: null
    },
    {
      name: 'Alice Employee',
      email: 'alice.employee@techcorp.com',
      role: 'employee',
      manager_id: null // Will be set after manager creation
    },
    {
      name: 'Bob Employee',
      email: 'bob.employee@techcorp.com',
      role: 'employee',
      manager_id: null
    },
    {
      name: 'Charlie Employee',
      email: 'charlie.employee@techcorp.com',
      role: 'employee',
      manager_id: null
    },
    {
      name: 'Diana Employee',
      email: 'diana.employee@techcorp.com',
      role: 'employee',
      manager_id: null
    }
  ];

  const results = [];
  
  // Create admin first
  const adminResult = await db.run(
    'INSERT INTO users (company_id, email, password_hash, name, role, manager_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [companyId, users[0].email, passwordHash, users[0].name, users[0].role, null, 1]
  );
  results.push({ id: adminResult.id, ...users[0] });

  // Create managers
  const johnResult = await db.run(
    'INSERT INTO users (company_id, email, password_hash, name, role, manager_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [companyId, users[1].email, passwordHash, users[1].name, users[1].role, adminResult.id, 1]
  );
  results.push({ id: johnResult.id, ...users[1] });

  const sarahResult = await db.run(
    'INSERT INTO users (company_id, email, password_hash, name, role, manager_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [companyId, users[2].email, passwordHash, users[2].name, users[2].role, adminResult.id, 1]
  );
  results.push({ id: sarahResult.id, ...users[2] });

  // Create employees under managers
  const employees = users.slice(3);
  for (let i = 0; i < employees.length; i++) {
    const managerId = i < 2 ? johnResult.id : sarahResult.id; // Split employees between managers
    const result = await db.run(
      'INSERT INTO users (company_id, email, password_hash, name, role, manager_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [companyId, employees[i].email, passwordHash, employees[i].name, employees[i].role, managerId, 1]
    );
    results.push({ id: result.id, ...employees[i], manager_id: managerId });
  }

  return results;
};

// Create Approval Rules
const createApprovalRules = async (companyId, users) => {
  const managers = users.filter(u => u.role === 'manager');
  const admin = users.find(u => u.role === 'admin');

  const rules = [
    {
      name: 'Small Amount Approval',
      description: 'For expenses under $100 - Manager approval only',
      rule_type: 'percentage',
      percentage_threshold: 100.00,
      specific_approver_id: null,
      is_manager_approver: 1
    },
    {
      name: 'Medium Amount Approval',
      description: 'For expenses $100-$1000 - Manager + Admin approval',
      rule_type: 'hybrid',
      percentage_threshold: 1000.00,
      specific_approver_id: admin.id,
      is_manager_approver: 1
    },
    {
      name: 'Large Amount Approval',
      description: 'For expenses over $1000 - Admin approval required',
      rule_type: 'specific_approver',
      percentage_threshold: null,
      specific_approver_id: admin.id,
      is_manager_approver: 0
    },
    {
      name: 'Travel Expense Approval',
      description: 'Special approval for travel expenses',
      rule_type: 'hybrid',
      percentage_threshold: 500.00,
      specific_approver_id: managers[0].id,
      is_manager_approver: 1
    }
  ];

  const results = [];
  for (const rule of rules) {
    const result = await db.run(
      `INSERT INTO approval_rules (company_id, name, description, rule_type, percentage_threshold, specific_approver_id, is_manager_approver, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyId, rule.name, rule.description, rule.rule_type, rule.percentage_threshold, rule.specific_approver_id, rule.is_manager_approver, 1]
    );
    results.push({ id: result.id, ...rule });
  }

  return results;
};

// Create Approval Sequences
const createApprovalSequences = async (approvalRules, users) => {
  const managers = users.filter(u => u.role === 'manager');
  const admin = users.find(u => u.role === 'admin');

  const sequences = [];
  
  for (const rule of approvalRules) {
    if (rule.rule_type === 'hybrid' && rule.is_manager_approver) {
      // Manager first, then specific approver
      await db.run(
        'INSERT INTO approval_sequences (approval_rule_id, approver_id, sequence_order, is_required) VALUES (?, ?, ?, ?)',
        [rule.id, managers[0].id, 1, 1]
      );
      await db.run(
        'INSERT INTO approval_sequences (approval_rule_id, approver_id, sequence_order, is_required) VALUES (?, ?, ?, ?)',
        [rule.id, rule.specific_approver_id, 2, 1]
      );
      sequences.push({ rule_id: rule.id, steps: 2 });
    } else if (rule.is_manager_approver) {
      // Manager only
      await db.run(
        'INSERT INTO approval_sequences (approval_rule_id, approver_id, sequence_order, is_required) VALUES (?, ?, ?, ?)',
        [rule.id, managers[0].id, 1, 1]
      );
      sequences.push({ rule_id: rule.id, steps: 1 });
    } else if (rule.specific_approver_id) {
      // Specific approver only
      await db.run(
        'INSERT INTO approval_sequences (approval_rule_id, approver_id, sequence_order, is_required) VALUES (?, ?, ?, ?)',
        [rule.id, rule.specific_approver_id, 1, 1]
      );
      sequences.push({ rule_id: rule.id, steps: 1 });
    }
  }

  return sequences;
};

// Create Expenses
const createExpenses = async (companyId, users) => {
  const employees = users.filter(u => u.role === 'employee');
  const expenses = [];

  const categories = ['Travel', 'Meals', 'Office Supplies', 'Equipment', 'Software', 'Training', 'Marketing', 'Utilities'];
  const statuses = ['draft', 'submitted', 'waiting_approval', 'approved', 'rejected'];

  // Create diverse expenses
  const expenseData = [
    { amount: 45.50, category: 'Meals', description: 'Business lunch with client', status: 'approved' },
    { amount: 1250.00, category: 'Travel', description: 'Flight tickets to San Francisco', status: 'waiting_approval' },
    { amount: 89.99, category: 'Office Supplies', description: 'Stationary and office materials', status: 'submitted' },
    { amount: 2500.00, category: 'Equipment', description: 'MacBook Pro for development', status: 'approved' },
    { amount: 299.00, category: 'Software', description: 'Adobe Creative Suite license', status: 'draft' },
    { amount: 450.00, category: 'Training', description: 'AWS Certification course', status: 'submitted' },
    { amount: 125.75, category: 'Meals', description: 'Team dinner after project completion', status: 'approved' },
    { amount: 75.00, category: 'Utilities', description: 'Internet bill for home office', status: 'rejected' },
    { amount: 189.50, category: 'Marketing', description: 'Google Ads campaign', status: 'waiting_approval' },
    { amount: 35.20, category: 'Travel', description: 'Uber rides for client meetings', status: 'approved' }
  ];

  for (let i = 0; i < expenseData.length; i++) {
    const expense = expenseData[i];
    const employee = employees[i % employees.length];
    const expenseDate = new Date();
    expenseDate.setDate(expenseDate.getDate() - Math.floor(Math.random() * 30)); // Random date within last 30 days

    const result = await db.run(
      `INSERT INTO expenses (company_id, employee_id, amount, currency, amount_in_company_currency, exchange_rate, category, description, expense_date, status, remarks) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        employee.id,
        expense.amount,
        'USD',
        expense.amount,
        1.0,
        expense.category,
        expense.description,
        expenseDate.toISOString().split('T')[0],
        expense.status,
        `Created by ${employee.name} for testing purposes`
      ]
    );
    expenses.push({ id: result.id, ...expense, employee_id: employee.id });
  }

  return expenses;
};

// Create Approval Requests
const createApprovalRequests = async (expenses, approvalRules) => {
  const requests = [];
  const submittedExpenses = expenses.filter(e => ['submitted', 'waiting_approval', 'approved', 'rejected'].includes(e.status));

  for (const expense of submittedExpenses) {
    // Select appropriate approval rule based on amount
    let selectedRule;
    if (expense.amount < 100) {
      selectedRule = approvalRules.find(r => r.name === 'Small Amount Approval');
    } else if (expense.amount <= 1000) {
      selectedRule = approvalRules.find(r => r.name === 'Medium Amount Approval');
    } else {
      selectedRule = approvalRules.find(r => r.name === 'Large Amount Approval');
    }

    if (selectedRule) {
      const totalSteps = selectedRule.rule_type === 'hybrid' && selectedRule.is_manager_approver ? 2 : 1;
      const currentStep = expense.status === 'waiting_approval' ? 1 : (expense.status === 'approved' ? totalSteps : 1);
      
      let requestStatus;
      if (expense.status === 'waiting_approval') {
        requestStatus = 'pending';
      } else if (expense.status === 'approved') {
        requestStatus = 'approved';
      } else if (expense.status === 'rejected') {
        requestStatus = 'rejected';
      } else {
        requestStatus = 'pending';
      }
      
      const result = await db.run(
        'INSERT INTO approval_requests (expense_id, approval_rule_id, status, current_step, total_steps) VALUES (?, ?, ?, ?, ?)',
        [
          expense.id, 
          selectedRule.id, 
          requestStatus,
          currentStep,
          totalSteps
        ]
      );
      requests.push({ id: result.id, expense_id: expense.id, rule_id: selectedRule.id });
    }
  }

  return requests;
};

// Create Approval Actions
const createApprovalActions = async (approvalRequests, users) => {
  const managers = users.filter(u => u.role === 'manager');
  const admin = users.find(u => u.role === 'admin');
  const actions = [];

  // Get some completed requests to create actions for
  const completedRequests = approvalRequests.slice(0, 5); // First 5 requests

  for (const request of completedRequests) {
    const approver = Math.random() > 0.5 ? managers[0] : admin;
    const action = Math.random() > 0.8 ? 'reject' : 'approve';
    
    const result = await db.run(
      'INSERT INTO approval_actions (approval_request_id, approver_id, action, comments, step_number) VALUES (?, ?, ?, ?, ?)',
      [
        request.id,
        approver.id,
        action,
        action === 'approve' ? 'Approved - expense looks reasonable' : 'Rejected - insufficient documentation',
        1
      ]
    );
    actions.push({ id: result.id, request_id: request.id, action });
  }

  return actions;
};

// Create Exchange Rates
const createExchangeRates = async () => {
  const rates = [
    { base: 'USD', target: 'EUR', rate: 0.85 },
    { base: 'USD', target: 'GBP', rate: 0.73 },
    { base: 'USD', target: 'CAD', rate: 1.35 },
    { base: 'USD', target: 'INR', rate: 83.25 },
    { base: 'EUR', target: 'USD', rate: 1.18 },
    { base: 'GBP', target: 'USD', rate: 1.37 }
  ];

  const results = [];
  for (const rate of rates) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    const result = await db.run(
      'INSERT INTO exchange_rates (base_currency, target_currency, rate, expires_at) VALUES (?, ?, ?, ?)',
      [rate.base, rate.target, rate.rate, expiresAt.toISOString()]
    );
    results.push({ id: result.id, ...rate });
  }

  return results;
};

// Create OCR Results
const createOCRResults = async (expenses) => {
  const results = [];
  const sampleExpenses = expenses.slice(0, 3); // Create OCR results for first 3 expenses

  for (const expense of sampleExpenses) {
    const parsedFields = JSON.stringify({
      vendor: expense.category === 'Meals' ? 'Restaurant ABC' : 'Vendor XYZ',
      amount: expense.amount,
      currency: 'USD',
      date: expense.expense_date,
      category: expense.category,
      lineItems: [
        { description: 'Item 1', amount: expense.amount * 0.6 },
        { description: 'Item 2', amount: expense.amount * 0.4 }
      ],
      confidence_details: {
        vendor: 85,
        amount: 92,
        date: 78,
        category: 88
      }
    });

    const result = await db.run(
      'INSERT INTO ocr_results (expense_id, file_path, parsed_fields, confidence_score, processing_status) VALUES (?, ?, ?, ?, ?)',
      [expense.id, `./uploads/receipts/receipt_${expense.id}.jpg`, parsedFields, 87.5, 'completed']
    );
    results.push({ id: result.id, expense_id: expense.id });
  }

  return results;
};

// Display Data Summary
const displayDataSummary = async () => {
  console.log('\n📊 DATABASE SUMMARY:');
  console.log('==================');

  const tables = [
    'companies', 'users', 'approval_rules', 'approval_sequences', 
    'expenses', 'approval_requests', 'approval_actions', 'exchange_rates', 'ocr_results'
  ];

  for (const table of tables) {
    const count = await db.get(`SELECT COUNT(*) as count FROM ${table}`);
    console.log(`${table.toUpperCase()}: ${count.count} records`);
  }

  // Show some sample data
  console.log('\n👥 USERS:');
  const users = await db.all('SELECT name, email, role FROM users ORDER BY role, name');
  users.forEach(user => console.log(`  ${user.role.toUpperCase()}: ${user.name} (${user.email})`));

  console.log('\n💰 EXPENSES SUMMARY:');
  const expenseStats = await db.get(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
      SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
      SUM(CASE WHEN status = 'waiting_approval' THEN 1 ELSE 0 END) as waiting_approval,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      ROUND(SUM(amount), 2) as total_amount
    FROM expenses
  `);
  console.log(`  Total: ${expenseStats.total} expenses worth $${expenseStats.total_amount}`);
  console.log(`  Draft: ${expenseStats.draft}, Submitted: ${expenseStats.submitted}, Waiting Approval: ${expenseStats.waiting_approval}`);
  console.log(`  Approved: ${expenseStats.approved}, Rejected: ${expenseStats.rejected}`);
};

// Run the script
if (require.main === module) {
  generateDummyData().then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { generateDummyData, clearAllData };