# 🚀 Expense Tracker API Testing with Postman

This guide will help you test all the Expense Tracker APIs using Postman with the provided collection and environment.

## 📋 Prerequisites

1. **Postman installed** (Download from https://www.postman.com/)
2. **Server running** on `http://localhost:5000`
3. **Database populated** with dummy data (run `node scripts/populate-dummy-data.js`)

## 🔧 Setup Instructions

### Step 1: Import the Collection
1. Open Postman
2. Click **Import** button (top left)
3. Select **File** tab
4. Choose `Expense-Tracker-API.postman_collection.json` from the `postman` folder
5. Click **Import**

### Step 2: Import the Environment
1. Click the **Environment** dropdown (top right)
2. Click **Import** 
3. Select `Expense-Tracker-Environment.postman_environment.json`
4. Click **Import**
5. Select "**Expense Tracker Environment**" from the dropdown

### Step 3: Start Your Server
```bash
# In your backend directory
npm run dev
```

## 🧪 Testing Workflow

### Phase 1: Authentication & Setup 🔐

**Run these requests in order:**

1. **🏥 Health Check** - Verify server is running
2. **📋 API Documentation** - Get available endpoints
3. **Admin Login** - Login as admin and save token
4. **Manager Login** - Login as manager and save token  
5. **Employee Login** - Login as employee and save token

**Expected Results:**
- All requests return 200 OK
- Tokens are automatically saved to environment variables
- Console shows "Token saved" messages

### Phase 2: Employee Operations 👤

**Switch to Employee token for these:**

6. **Get Current User** - View employee profile
7. **Get All Expenses** - See employee's expenses (3-4 expenses)
8. **Create Expense** - Create new expense (auto-saves expense ID)
9. **Update Expense** - Modify the created expense
10. **Submit Expense** - Submit for approval
11. **Get My Expenses** - View all employee expenses

### Phase 3: Manager Operations 👔

**Switch to Manager token:**

12. **Get Current User** - View manager profile
13. **Get All Expenses** - See team expenses (7+ expenses)
14. **Get Pending Expenses** - See expenses awaiting approval
15. **Approve Expense** - Approve a pending expense
16. **Reject Expense** - Reject a pending expense

### Phase 4: Admin Operations 🔧

**Switch to Admin token:**

17. **Get All Users** - View all system users
18. **Create User** - Add new employee
19. **Get Approval Rules** - View approval rules
20. **Create Approval Rule** - Add new approval rule
21. **Admin Override Expense** - Override expense status

### Phase 5: OCR Testing 🔍

**Using Employee token:**

22. **Get OCR Result** - View existing OCR data
23. **Get OCR Stats** (Admin) - View OCR statistics
24. **Parse Receipt** - Upload receipt image (requires image file)

## 🔑 Test Credentials

```
Admin:    admin@techcorp.com / password123
Manager:  john.manager@techcorp.com / password123  
Employee: alice.employee@techcorp.com / password123
```

## 📊 Expected Test Results

### ✅ Success Scenarios:
- **Health Check**: Server status OK
- **Login requests**: Return user data + JWT token
- **Employee expenses**: Shows 3-4 expenses for Alice Employee
- **Manager expenses**: Shows 7+ expenses from team members
- **Admin users**: Shows all 7 users in system
- **Create operations**: Return 201 Created with new resource ID

### ⚠️ Expected Failures (by design):
- **Employee accessing other user's expense**: 403 Forbidden
- **Manager accessing admin-only endpoints**: 403 Forbidden
- **Requests without authentication**: 401 Unauthorized
- **Invalid expense IDs**: 404 Not Found

## 🔧 Troubleshooting

### Common Issues:

**❌ Connection Error**
```
Error: connect ECONNREFUSED 127.0.0.1:5000
```
**Solution:** Make sure your server is running (`npm run dev`)

**❌ 401 Unauthorized**
```
{"error": "Access token required"}
```
**Solution:** Run the login request first to get a token

**❌ 403 Forbidden**  
```
{"error": "Access denied: insufficient permissions"}
```
**Solution:** Use the correct user role token (admin/manager/employee)

**❌ 404 Not Found**
```
{"error": "Expense not found"}
```
**Solution:** Use valid IDs from your database (check Get All Expenses first)

### Debugging Tips:

1. **Check Console**: Postman Console (View > Show Postman Console) shows detailed request/response info
2. **Verify Environment**: Ensure "Expense Tracker Environment" is selected
3. **Check Variables**: View environment variables to see if tokens are saved
4. **Test Server**: Try the Health Check endpoint first

## 📝 Custom Testing Scenarios

### Test Role-Based Access:
```javascript
// Try these with different user tokens:
GET /expenses         // Employee: 3-4 items, Manager: 7+ items, Admin: 10+ items
GET /auth/users       // Employee: 403, Manager: 403, Admin: 200 + user list
POST /auth/users      // Employee: 403, Manager: 403, Admin: 201 + new user
```

### Test Expense Workflow:
```javascript
1. Employee creates expense    → Status: draft
2. Employee submits expense    → Status: submitted  
3. Manager approves expense    → Status: approved
4. Admin can override any      → Status: admin override
```

### Test Data Validation:
```javascript
// Try invalid data to see validation errors:
{
  "amount": -50,           // Should fail: negative amount
  "email": "invalid",      // Should fail: invalid email format  
  "password": "123"        // Should fail: password too short
}
```

## 🚀 Advanced Testing

### Automated Testing:
The collection includes test scripts that:
- Automatically save tokens after login
- Validate response codes
- Extract and store resource IDs
- Log success/failure messages

### Collection Runner:
1. Click **Runner** in Postman
2. Select the "Expense Tracker API" collection
3. Choose the "Expense Tracker Environment"
4. Click **Run** to execute all requests automatically

### Environment Variables:
The collection uses these variables:
```
{{baseUrl}}         - Server URL (http://localhost:5000)
{{adminToken}}      - Admin JWT token (auto-saved)
{{managerToken}}    - Manager JWT token (auto-saved)  
{{employeeToken}}   - Employee JWT token (auto-saved)
{{newExpenseId}}    - ID of newly created expense (auto-saved)
```

## 📈 Monitoring & Analytics

### Response Time Tracking:
- Health Check: < 50ms
- Authentication: < 200ms  
- Database queries: < 500ms
- File uploads: < 2000ms

### Success Rate Monitoring:
- Authentication endpoints: 100% success
- CRUD operations: 95%+ success
- Role-based access: Expected failures for security

## 💡 Tips for Effective Testing

1. **Start with Health Check** - Always verify server status first
2. **Login First** - Most endpoints require authentication
3. **Use Real IDs** - Check database for valid expense/user IDs
4. **Test Different Roles** - Each role has different permissions
5. **Check Response Codes** - 200/201 = success, 4xx = client error, 5xx = server error
6. **Read Error Messages** - They provide specific guidance on fixing issues

## 🎯 Testing Checklist

- [ ] Server is running on port 5000
- [ ] Database has dummy data populated
- [ ] Postman collection imported successfully  
- [ ] Environment file imported and selected
- [ ] Health check returns 200 OK
- [ ] All three login requests succeed and save tokens
- [ ] Employee can create/update/submit expenses
- [ ] Manager can view team expenses and approve/reject
- [ ] Admin can manage users and override expenses
- [ ] Role-based permissions work correctly
- [ ] All CRUD operations function properly

---

## 🎉 Success!

If all tests pass, your Expense Tracker API is fully functional and ready for production use!

For additional help, check the API documentation at: `http://localhost:5000/api-docs`