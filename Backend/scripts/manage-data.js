#!/usr/bin/env node

const { generateDummyData, clearAllData } = require('./populate-dummy-data');
const { runAllTests } = require('./test-api');

const args = process.argv.slice(2);
const command = args[0];

const showHelp = () => {
  console.log(`
🚀 Expense Tracker Database Management Tool

Usage: node scripts/manage-data.js <command>

Commands:
  populate    - Populate database with fresh dummy data
  clear       - Clear all data from database  
  test        - Run API tests (server must be running)
  help        - Show this help message

Examples:
  node scripts/manage-data.js populate
  node scripts/manage-data.js test
  node scripts/manage-data.js clear

Test Credentials (after populate):
  Admin:    admin@techcorp.com / password123
  Manager:  john.manager@techcorp.com / password123  
  Employee: alice.employee@techcorp.com / password123
  `);
};

const main = async () => {
  switch (command) {
    case 'populate':
      console.log('🔄 Populating database with dummy data...\n');
      await generateDummyData();
      break;
      
    case 'clear':
      console.log('🗑️  Clearing all database data...\n');
      await clearAllData();
      console.log('✅ Database cleared successfully!');
      break;
      
    case 'test':
      console.log('🧪 Running API tests...\n');
      const success = await runAllTests();
      process.exit(success ? 0 : 1);
      break;
      
    case 'help':
    case undefined:
      showHelp();
      break;
      
    default:
      console.log(`❌ Unknown command: ${command}\n`);
      showHelp();
      process.exit(1);
  }
};

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});