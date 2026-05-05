@echo off
echo Starting Expense Tracker Frontend...
echo.
echo Prerequisites:
echo - Backend server should be running on http://localhost:5000
echo - Node.js and npm should be installed
echo.
pause

echo Installing dependencies...
npm install

echo.
echo Starting development server on port 3001...
npm run dev -- -p 3001
