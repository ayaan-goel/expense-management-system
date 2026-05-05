# Expense Management System - Backend

A comprehensive expense management system with multi-level approval workflows, OCR receipt processing, and role-based access control.

## Features

- **User Management**: Role-based access (Admin, Manager, Employee)
- **Multi-level Approval Workflows**: Configurable approval sequences with conditional rules
- **OCR Integration**: Automated receipt parsing using Tesseract.js
- **Currency Management**: Multi-currency support with real-time conversion
- **File Upload**: Secure attachment handling for receipts and documents
- **RESTful API**: Complete API with authentication and validation
- **Security**: JWT authentication, input validation, rate limiting

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Authentication**: JWT, bcryptjs
- **File Upload**: Express-fileupload, Multer
- **OCR**: Tesseract.js
- **Validation**: Joi
- **Security**: Helmet, CORS, Rate limiting

## Project Structure

```
backend/
├── controllers/          # Request handlers
│   ├── authController.js
│   ├── expenseController.js
│   ├── approvalController.js
│   ├── adminController.js
│   └── ocrController.js
├── middleware/           # Custom middleware
│   ├── auth.js          # JWT and role-based auth
│   ├── validation.js    # Request validation
│   └── fileUpload.js    # File handling
├── routes/              # API routes
│   ├── auth.js
│   ├── expenses.js
│   ├── approvals.js
│   ├── admin.js
│   └── ocr.js
├── services/            # Business logic
│   ├── currencyService.js
│   ├── ocrService.js
│   └── approvalEngine.js
├── scripts/             # Database setup
│   ├── initDatabase.js
│   └── seedData.js
├── uploads/             # File storage
└── server.js            # Application entry point
```

## Environment Variables

Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DB_PATH=./database.sqlite

# JWT Secret (generate a secure random string)
JWT_SECRET=your-super-secret-jwt-key-here

# External APIs
RESTCOUNTRIES_API_URL=https://restcountries.com/v3.1
EXCHANGERATE_API_KEY=your-exchangerate-api-key
EXCHANGERATE_API_URL=https://api.exchangerate-api.com/v4/latest

# File Upload Limits
MAX_FILE_SIZE=10485760
MAX_FILES=5

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your actual values
```

3. Initialize database and seed with demo data:
```bash
npm run setup
# This runs: npm run init-db && npm run seed
```

4. Start the server:
```bash
npm start
# or for development with auto-reload
npm run dev
```

## Demo Data

After running `npm run seed`, you can login with these demo accounts:

| Role | Email | Password | Description |
|------|--------|----------|-------------|
| Admin | admin@techcorp.com | password123 | Can manage users and approval rules |
| Manager | manager@techcorp.com | password123 | Can approve expenses up to $200 |
| Employee | charlie@techcorp.com | password123 | Has expenses in various states |
| Employee | diana@techcorp.com | password123 | Has approved/rejected expenses |

The seed data includes:
- Sample approval rules (auto-approve <$50, manager approval <$200, admin approval >$200)
- Expenses in different states (draft, waiting approval, approved, rejected)
- Sample OCR results and approval workflows

## Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm run init-db` - Initialize database schema
- `npm run seed` - Populate database with demo data
- `npm run setup` - Initialize database and seed data
- `npm run reset` - Delete database and recreate with seed data

## API Documentation

### Authentication

#### POST /api/auth/signup
Register a new user and create company.

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepassword",
    "companyName": "Acme Corp",
    "country": "US"
  }'
```

#### POST /api/auth/login
Authenticate user and get JWT token.

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securepassword"
  }'
```

#### GET /api/auth/me
Get current user information.

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Expense Management

#### POST /api/expenses
Create a new expense.

```bash
curl -X POST http://localhost:3000/api/expenses \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "title=Business Lunch" \
  -F "description=Client meeting" \
  -F "amount=75.50" \
  -F "currency=USD" \
  -F "category=meals" \
  -F "expenseDate=2024-12-01" \
  -F "attachment=@receipt.jpg"
```

#### GET /api/expenses/my
Get current user's expenses.

```bash
curl -X GET http://localhost:3000/api/expenses/my \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### POST /api/expenses/:id/submit
Submit expense for approval.

```bash
curl -X POST http://localhost:3000/api/expenses/123/submit \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### GET /api/expenses/pending
Get expenses pending approval (Manager/Admin only).

```bash
curl -X GET http://localhost:3000/api/expenses/pending \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Approval Management

#### POST /api/approvals/:requestId/approve
Approve an expense request.

```bash
curl -X POST http://localhost:3000/api/approvals/123/approve \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comments": "Approved for business purposes"}'
```

#### POST /api/approvals/:requestId/reject
Reject an expense request.

```bash
curl -X POST http://localhost:3000/api/approvals/123/reject \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comments": "Missing receipt"}'
```

### OCR Processing

#### POST /api/ocr/process
Process receipt image with OCR.

```bash
curl -X POST http://localhost:3000/api/ocr/process \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@receipt.jpg"
```

#### GET /api/ocr/results/:ocrId
Get OCR processing results.

```bash
curl -X GET http://localhost:3000/api/ocr/results/123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### POST /api/ocr/create-expense/:ocrId
Create expense from OCR data.

```bash
curl -X POST http://localhost:3000/api/ocr/create-expense/123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category": "office_supplies"}'
```

### Admin Management

#### GET /api/admin/dashboard
Get admin dashboard statistics.

```bash
curl -X GET http://localhost:3000/api/admin/dashboard \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

#### POST /api/admin/rules
Create approval rule.

```bash
curl -X POST http://localhost:3000/api/admin/rules \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "percentage",
    "rule_name": "Auto Approve Small",
    "conditions": {"threshold": 25}
  }'
```

## Database Schema

### Core Tables

- **companies**: Organization data with currency and timezone
- **users**: User accounts with roles and manager relationships
- **expenses**: Expense records with amounts and status tracking
- **approval_rules**: Configurable approval conditions
- **approval_sequences**: Ordered approval workflows
- **approval_requests**: Active approval processes
- **approval_actions**: History of approval decisions
- **ocr_results**: OCR processing results and parsed data
- **exchange_rates**: Cached currency conversion rates

### Expense States

- `draft`: Not yet submitted
- `waiting_approval`: Submitted and pending approval
- `approved`: Approved and ready for reimbursement
- `rejected`: Rejected with comments
- `cancelled`: Cancelled by user

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-based Access Control**: Admin, Manager, Employee roles
- **Input Validation**: Joi schema validation for all inputs
- **Rate Limiting**: Protection against spam and abuse
- **File Upload Security**: File type and size validation
- **CORS Configuration**: Cross-origin request handling
- **Helmet Security**: Security headers and protections

## Approval Workflow

The system supports three types of approval rules:

1. **Percentage Rules**: Auto-approve expenses below threshold
2. **Specific Approver Rules**: Route to designated approver above threshold
3. **Hybrid Rules**: Combine percentage and specific approver logic

Approval sequences can contain multiple rules that are evaluated in order, creating sophisticated multi-level approval workflows.

## File Upload Handling

- Secure file upload with validation
- Support for common image and document formats
- File size limits and type restrictions
- Temporary and permanent storage management
- Automatic cleanup of unused files

## Currency Management

- Integration with RestCountries API for company setup
- Real-time currency conversion using ExchangeRate API
- Caching of exchange rates to minimize API calls
- Support for multiple currencies within the same company

## OCR Integration

- Automated receipt processing using Tesseract.js
- Extraction of vendor, amount, date, and line items
- Confidence scoring for accuracy assessment
- Storage of raw text and parsed data
- Re-processing capabilities for failed attempts

## Error Handling

The API uses standard HTTP status codes and returns consistent error responses:

```json
{
  "error": "Validation failed",
  "message": "Amount must be greater than 0",
  "details": {
    "field": "amount",
    "code": "INVALID_VALUE"
  }
}
```

## Testing

Use the provided demo accounts to test different user roles and workflows:

1. Login as employee to create and submit expenses
2. Login as manager to approve/reject submitted expenses
3. Login as admin to manage users and approval rules
4. Test OCR functionality with sample receipt images
5. Test multi-level approval workflows with large expenses

## Production Deployment

1. Set `NODE_ENV=production` in your environment
2. Use a strong, random JWT_SECRET
3. Configure proper file storage (consider cloud storage for production)
4. Set up database backups
5. Configure reverse proxy (nginx) for SSL termination
6. Monitor logs and set up error tracking
7. Consider using process managers like PM2

## Local Development & Troubleshooting

### Package Management

This project uses npm with `package-lock.json` committed to the repository for consistent dependency versions.

**Important:**
```bash
# Always use npm ci for clean installs
npm ci

# Only use npm install when adding new dependencies
npm install

# When adding new dependencies, commit both package.json and package-lock.json
git add package.json package-lock.json
git commit -m "Add new dependency: package-name"
```

### Git Workflow

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd backend
   npm ci  # Use ci for clean install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   npm run setup  # Initialize database and seed data
   ```

### Files Ignored by Git

- `node_modules/` - Dependencies (will be installed via `npm ci`)
- `.env` - Environment variables (use `.env.example` as template)
- `*.sqlite` - Database files (each developer has their own local database)
- `uploads/` - Uploaded files (except structure-maintaining `.gitkeep` files)
- IDE-specific files (`.vscode/`, `.idea/`, etc.)
- OS-specific files (`Thumbs.db`, `.DS_Store`, etc.)
- Log files and temporary files

### Important Notes

- **Never commit sensitive data** like API keys, passwords, or database files
- **Always test locally** before pushing: `npm start` should work without errors
- **Database**: Local SQLite database
- **Uploads**: Uploaded files are ignored; use seed data for testing
- **Environment**: Copy `.env.example` to `.env` and set your own values

### Troubleshooting

**Different node_modules causing issues:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Database issues:**
```bash
rm -f database.sqlite
npm run setup
```

**Port conflicts:**
Change `PORT` in your `.env` file to a different port (e.g., 3001, 5001)

## License

MIT License - see LICENSE file for details.
