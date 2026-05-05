#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Expense Tracker Frontend...\n');

// Install dependencies
console.log('📦 Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed successfully\n');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Create .env.local if it doesn't exist
const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, 'NEXT_PUBLIC_API_URL=http://localhost:5000\n');
  console.log('📝 Created .env.local file');
}

console.log('🎉 Setup complete! You can now run:');
console.log('   npm run dev - Start development server');
console.log('   npm run build - Build for production');
console.log('   npm start - Start production server\n');

console.log('🔗 The frontend will be available at: http://localhost:3000');
console.log('🔗 Make sure your backend is running at: http://localhost:5000\n');

console.log('👤 Test credentials:');
console.log('   Admin:    admin@techcorp.com / password123');
console.log('   Manager:  john.manager@techcorp.com / password123');
console.log('   Employee: alice.employee@techcorp.com / password123');