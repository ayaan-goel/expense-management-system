#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Postman testing environment...\n');

// Check if server is running
const checkServer = async () => {
  try {
    const response = await fetch('http://localhost:5000/health');
    if (response.ok) {
      console.log('✅ Server is running on http://localhost:5000');
      return true;
    }
  } catch (error) {
    console.log('❌ Server is not running');
    console.log('   Please start the server with: npm run dev\n');
    return false;
  }
};

// Check if postman files exist
const checkPostmanFiles = () => {
  const postmanDir = path.join(__dirname, '..', 'postman');
  const collectionFile = path.join(postmanDir, 'Expense-Tracker-API.postman_collection.json');
  const environmentFile = path.join(postmanDir, 'Expense-Tracker-Environment.postman_environment.json');
  const guideFile = path.join(postmanDir, 'POSTMAN-TESTING-GUIDE.md');

  let allFilesExist = true;

  if (!fs.existsSync(collectionFile)) {
    console.log('❌ Postman collection file not found');
    allFilesExist = false;
  } else {
    console.log('✅ Postman collection file exists');
  }

  if (!fs.existsSync(environmentFile)) {
    console.log('❌ Postman environment file not found');
    allFilesExist = false;
  } else {
    console.log('✅ Postman environment file exists');
  }

  if (!fs.existsSync(guideFile)) {
    console.log('❌ Postman testing guide not found');
    allFilesExist = false;
  } else {
    console.log('✅ Postman testing guide exists');
  }

  return allFilesExist;
};

// Check if database has data
const checkDatabase = async () => {
  try {
    const db = require('../models/database');
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    const expenseCount = await db.get('SELECT COUNT(*) as count FROM expenses');
    
    if (userCount.count > 0 && expenseCount.count > 0) {
      console.log(`✅ Database has data: ${userCount.count} users, ${expenseCount.count} expenses`);
      return true;
    } else {
      console.log('❌ Database is empty or missing data');
      console.log('   Run: node scripts/populate-dummy-data.js\n');
      return false;
    }
  } catch (error) {
    console.log('❌ Could not check database');
    console.log('   Error:', error.message);
    return false;
  }
};

// Show test credentials
const showCredentials = () => {
  console.log('\n🔑 Test Credentials:');
  console.log('==================');
  console.log('Admin:     admin@techcorp.com / password123');
  console.log('Manager:   john.manager@techcorp.com / password123');
  console.log('Employee:  alice.employee@techcorp.com / password123\n');
};

// Show setup instructions
const showInstructions = () => {
  console.log('📋 Postman Setup Instructions:');
  console.log('==============================');
  console.log('1. Open Postman');
  console.log('2. Import Collection: postman/Expense-Tracker-API.postman_collection.json');
  console.log('3. Import Environment: postman/Expense-Tracker-Environment.postman_environment.json');
  console.log('4. Select "Expense Tracker Environment" in the dropdown');
  console.log('5. Start testing with the Health Check request\n');
  
  console.log('📖 For detailed instructions, see:');
  console.log('   postman/POSTMAN-TESTING-GUIDE.md\n');
};

// Show quick test commands
const showQuickTests = () => {
  console.log('🧪 Quick Test Commands:');
  console.log('=======================');
  console.log('Test API endpoints:     node scripts/test-api.js');
  console.log('Populate dummy data:    node scripts/populate-dummy-data.js');
  console.log('Clear database:         node scripts/manage-data.js clear');
  console.log('Show this help:         node scripts/setup-postman-testing.js\n');
};

// Main setup function
const runSetup = async () => {
  console.log('🔍 Checking prerequisites...\n');

  const serverRunning = await checkServer();
  const filesExist = checkPostmanFiles();
  const databaseReady = await checkDatabase();

  console.log('\n📊 Setup Status:');
  console.log('================');
  console.log(`Server Running: ${serverRunning ? '✅' : '❌'}`);
  console.log(`Postman Files: ${filesExist ? '✅' : '❌'}`);
  console.log(`Database Ready: ${databaseReady ? '✅' : '❌'}`);

  if (serverRunning && filesExist && databaseReady) {
    console.log('\n🎉 Everything is ready for Postman testing!');
    showCredentials();
    showInstructions();
  } else {
    console.log('\n⚠️  Some prerequisites are missing:');
    if (!serverRunning) {
      console.log('   - Start the server: npm run dev');
    }
    if (!filesExist) {
      console.log('   - Postman files are missing (this should not happen)');
    }
    if (!databaseReady) {
      console.log('   - Populate database: node scripts/populate-dummy-data.js');
    }
    console.log('');
  }

  showQuickTests();
};

// Test API endpoints programmatically
const testEndpoints = async () => {
  if (!await checkServer()) return;

  console.log('🧪 Testing key endpoints...\n');

  const tests = [
    { name: 'Health Check', url: '/health', expected: 200 },
    { name: 'API Docs', url: '/api-docs', expected: 200 }
  ];

  for (const test of tests) {
    try {
      const response = await fetch(`http://localhost:5000${test.url}`);
      const status = response.status === test.expected ? '✅' : '❌';
      console.log(`${status} ${test.name}: ${response.status}`);
    } catch (error) {
      console.log(`❌ ${test.name}: Failed (${error.message})`);
    }
  }

  console.log('\n💡 For complete API testing, use Postman or run: node scripts/test-api.js\n');
};

// Show file locations
const showFileLocations = () => {
  const postmanDir = path.join(__dirname, '..', 'postman');
  console.log('📁 Postman Files Location:');
  console.log('==========================');
  console.log(`Collection:   ${path.join(postmanDir, 'Expense-Tracker-API.postman_collection.json')}`);
  console.log(`Environment:  ${path.join(postmanDir, 'Expense-Tracker-Environment.postman_environment.json')}`);
  console.log(`Guide:        ${path.join(postmanDir, 'POSTMAN-TESTING-GUIDE.md')}\n`);
};

// Command line arguments handling
const args = process.argv.slice(2);
const command = args[0];

const main = async () => {
  switch (command) {
    case 'test':
      await testEndpoints();
      break;
    case 'files':
      showFileLocations();
      break;
    case 'credentials':
      showCredentials();
      break;
    case 'help':
      console.log('🚀 Postman Setup Helper\n');
      console.log('Usage: node scripts/setup-postman-testing.js [command]\n');
      console.log('Commands:');
      console.log('  (no command) - Run full setup check');
      console.log('  test         - Test key endpoints');
      console.log('  files        - Show file locations');  
      console.log('  credentials  - Show test credentials');
      console.log('  help         - Show this help\n');
      break;
    default:
      await runSetup();
  }
};

main().catch(error => {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
});