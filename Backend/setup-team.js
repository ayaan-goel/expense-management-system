#!/usr/bin/env node
/**
 * Team Setup Script for Expense Management System
 * 
 * This script helps new team members get started quickly by:
 * 1. Checking if required files exist
 * 2. Setting up environment variables
 * 3. Installing dependencies
 * 4. Initializing database
 * 5. Running tests
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up Expense Management System for team development...\n');

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
  console.error('❌ Error: package.json not found. Make sure you\'re in the backend directory.');
  process.exit(1);
}

// Step 1: Check for .env file
console.log('1️⃣ Checking environment configuration...');
if (!fs.existsSync('.env')) {
  if (fs.existsSync('.env.example')) {
    console.log('📝 Creating .env file from .env.example...');
    fs.copyFileSync('.env.example', '.env');
    console.log('✅ .env file created');
    console.log('⚠️  Please edit .env file with your actual configuration values');
  } else {
    console.error('❌ Error: .env.example not found');
    process.exit(1);
  }
} else {
  console.log('✅ .env file already exists');
}

// Step 2: Install dependencies
console.log('\n2️⃣ Installing dependencies...');
try {
  console.log('Running npm ci for clean dependency installation...');
  execSync('npm ci', { stdio: 'inherit' });
  console.log('✅ Dependencies installed successfully');
} catch (error) {
  console.error('❌ Error installing dependencies:', error.message);
  console.log('Trying with npm install...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed successfully');
  } catch (fallbackError) {
    console.error('❌ Failed to install dependencies:', fallbackError.message);
    process.exit(1);
  }
}

// Step 3: Check for database
console.log('\n3️⃣ Setting up database...');
if (fs.existsSync('database.sqlite')) {
  console.log('⚠️  Database file already exists');
  console.log('If you want to reset the database, run: npm run reset');
} else {
  console.log('Initializing database and adding seed data...');
  try {
    execSync('npm run setup', { stdio: 'inherit' });
    console.log('✅ Database initialized with seed data');
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    process.exit(1);
  }
}

// Step 4: Verify setup
console.log('\n4️⃣ Verifying setup...');
try {
  console.log('Testing server configuration...');
  execSync('node -c server.js', { stdio: 'pipe' });
  console.log('✅ Server configuration is valid');
} catch (error) {
  console.error('❌ Server configuration error:', error.message);
  process.exit(1);
}

// Step 5: Show next steps
console.log('\n🎉 Setup completed successfully!\n');
console.log('📋 Next steps:');
console.log('1. Edit .env file with your configuration values');
console.log('2. Start the development server: npm run dev');
console.log('3. Test the API endpoints using the examples in README.md');
console.log('\n💡 Useful commands:');
console.log('• npm run dev     - Start development server with auto-reload');
console.log('• npm start       - Start production server');
console.log('• npm run reset   - Reset database and seed data');
console.log('• npm run seed    - Add seed data only');

console.log('\n🔐 Demo login credentials:');
console.log('• Admin: admin@techcorp.com / password123');
console.log('• Manager: manager@techcorp.com / password123');
console.log('• Employee: charlie@techcorp.com / password123');

console.log('\n📖 Full documentation available in README.md');
console.log('\nHappy coding! 🚀');