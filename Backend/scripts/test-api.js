const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
let authToken = '';
let testResults = [];

// Test data
const testUsers = {
  admin: { email: 'admin@techcorp.com', password: 'password123' },
  manager: { email: 'john.manager@techcorp.com', password: 'password123' },
  employee: { email: 'alice.employee@techcorp.com', password: 'password123' }
};

// Helper function to log test results
const logTest = (testName, success, message, data = null) => {
  const result = {
    test: testName,
    status: success ? '✅ PASS' : '❌ FAIL',
    message,
    data: data ? JSON.stringify(data, null, 2) : null
  };
  testResults.push(result);
  console.log(`${result.status} ${testName}: ${message}`);
  if (data && success) {
    console.log(`   Data: ${JSON.stringify(data, null, 2).substring(0, 200)}...`);
  }
  console.log('');
};

// Helper function to make API requests
const apiRequest = async (method, endpoint, data = null, token = null) => {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {},
    data
  };

  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  return axios(config);
};

// Test functions
const testHealthCheck = async () => {
  try {
    const response = await apiRequest('GET', '/health');
    logTest('Health Check', response.status === 200, 'Server is healthy', response.data);
    return true;
  } catch (error) {
    logTest('Health Check', false, `Failed: ${error.message}`);
    return false;
  }
};

const testUserLogin = async (userType) => {
  try {
    const user = testUsers[userType];
    const response = await apiRequest('POST', '/auth/login', user);
    
    if (response.status === 200 && response.data.token) {
      authToken = response.data.token;
      logTest(`${userType.toUpperCase()} Login`, true, 'Login successful', {
        user: response.data.user,
        token: response.data.token.substring(0, 20) + '...'
      });
      return response.data.token;
    } else {
      logTest(`${userType.toUpperCase()} Login`, false, 'No token received');
      return null;
    }
  } catch (error) {
    logTest(`${userType.toUpperCase()} Login`, false, `Failed: ${error.response?.data?.error || error.message}`);
    return null;
  }
};

const testGetCurrentUser = async (token) => {
  try {
    const response = await apiRequest('GET', '/auth/me', null, token);
    logTest('Get Current User', response.status === 200, 'User data retrieved', response.data.user);
    return true;
  } catch (error) {
    logTest('Get Current User', false, `Failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
};

const testGetUsers = async (token) => {
  try {
    const response = await apiRequest('GET', '/auth/users?page=1&limit=10', null, token);
    logTest('Get All Users', response.status === 200, `Retrieved ${response.data.users?.length || 0} users`, {
      totalUsers: response.data.users?.length,
      pagination: response.data.pagination
    });
    return true;
  } catch (error) {
    logTest('Get All Users', false, `Failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
};

const testGetExpenses = async (token) => {
  try {
    const response = await apiRequest('GET', '/expenses?page=1&limit=10', null, token);
    logTest('Get Expenses', response.status === 200, `Retrieved ${response.data.expenses?.length || 0} expenses`, {
      totalExpenses: response.data.expenses?.length,
      pagination: response.data.pagination
    });
    return response.data.expenses || [];
  } catch (error) {
    logTest('Get Expenses', false, `Failed: ${error.response?.data?.error || error.message}`);
    return [];
  }
};

const testCreateExpense = async (token) => {
  const newExpense = {
    amount: 156.75,
    currency: 'USD',
    category: 'Testing',
    description: 'API Test Expense - Created by test script',
    expense_date: new Date().toISOString().split('T')[0],
    remarks: 'This is a test expense created by the API test script'
  };

  try {
    const response = await apiRequest('POST', '/expenses', newExpense, token);
    logTest('Create Expense', response.status === 201, 'Expense created successfully', {
      id: response.data.expense?.id,
      amount: response.data.expense?.amount,
      status: response.data.expense?.status
    });
    return response.data.expense;
  } catch (error) {
    logTest('Create Expense', false, `Failed: ${error.response?.data?.error || error.message}`);
    return null;
  }
};

const testGetExpenseById = async (token, expenseId) => {
  try {
    const response = await apiRequest('GET', `/expenses/${expenseId}`, null, token);
    logTest('Get Expense by ID', response.status === 200, 'Expense retrieved successfully', {
      id: response.data.expense?.id,
      amount: response.data.expense?.amount,
      category: response.data.expense?.category
    });
    return true;
  } catch (error) {
    logTest('Get Expense by ID', false, `Failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
};

const testUpdateExpense = async (token, expenseId) => {
  const updateData = {
    description: 'Updated API Test Expense - Modified by test script',
    amount: 199.99,
    remarks: 'Updated via API test'
  };

  try {
    const response = await apiRequest('PUT', `/expenses/${expenseId}`, updateData, token);
    logTest('Update Expense', response.status === 200, 'Expense updated successfully', {
      id: response.data.expense?.id,
      description: response.data.expense?.description,
      amount: response.data.expense?.amount
    });
    return true;
  } catch (error) {
    logTest('Update Expense', false, `Failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
};

const testApiDocumentation = async () => {
  try {
    const response = await apiRequest('GET', '/api-docs');
    logTest('API Documentation', response.status === 200, 'API docs accessible', {
      title: response.data.title,
      version: response.data.version,
      endpointCount: Object.keys(response.data.endpoints).length
    });
    return true;
  } catch (error) {
    logTest('API Documentation', false, `Failed: ${error.message}`);
    return false;
  }
};

// Main test runner
const runAllTests = async () => {
  console.log('🚀 Starting API Tests...\n');
  console.log(`Testing against: ${BASE_URL}\n`);

  let allTestsPassed = true;

  // Test 1: Health Check
  const healthOk = await testHealthCheck();
  if (!healthOk) {
    console.log('❌ Server is not healthy. Please start the server first.');
    return;
  }

  // Test 2: API Documentation
  await testApiDocumentation();

  // Test 3: Employee Login and Operations
  console.log('🔐 Testing Employee Login and Operations...');
  const employeeToken = await testUserLogin('employee');
  
  if (employeeToken) {
    await testGetCurrentUser(employeeToken);
    const expenses = await testGetExpenses(employeeToken);
    const newExpense = await testCreateExpense(employeeToken);
    
    if (newExpense?.id) {
      await testGetExpenseById(employeeToken, newExpense.id);
      await testUpdateExpense(employeeToken, newExpense.id);
    }
  }

  // Test 4: Manager Login and Operations
  console.log('\n👔 Testing Manager Login and Operations...');
  const managerToken = await testUserLogin('manager');
  
  if (managerToken) {
    await testGetCurrentUser(managerToken);
    await testGetExpenses(managerToken);
    // Managers can see more expenses than employees
  }

  // Test 5: Admin Login and Operations
  console.log('\n🔧 Testing Admin Login and Operations...');
  const adminToken = await testUserLogin('admin');
  
  if (adminToken) {
    await testGetCurrentUser(adminToken);
    await testGetUsers(adminToken); // Only admins can get all users
    await testGetExpenses(adminToken);
  }

  // Summary
  console.log('\n📊 TEST SUMMARY');
  console.log('===============');
  
  const passedTests = testResults.filter(t => t.status.includes('PASS')).length;
  const totalTests = testResults.length;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! Your API is working correctly with dummy data.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above for details.');
    allTestsPassed = false;
  }

  // Display failed tests
  const failedTests = testResults.filter(t => t.status.includes('FAIL'));
  if (failedTests.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    failedTests.forEach(test => {
      console.log(`   ${test.test}: ${test.message}`);
    });
  }

  return allTestsPassed;
};

// Export for use in other scripts
module.exports = { runAllTests };

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().then((success) => {
    process.exit(success ? 0 : 1);
  }).catch((error) => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}