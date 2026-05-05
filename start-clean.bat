@echo off
title Expense Tracker - Clean Startup
echo ========================================
echo    EXPENSE TRACKER - CLEAN STARTUP
echo ========================================
echo.

echo Cleaning up any existing processes...
echo ========================================
taskkill /f /im node.exe >nul 2>&1
echo Previous Node.js processes terminated.

echo.
echo Waiting 3 seconds for ports to be freed...
timeout /t 3 /nobreak >nul

echo.
echo Starting Backend Server (Port 5000)...
echo ========================================
start "Backend Server" cmd /k "cd /d \"E:\expense tracker\Backend\" && echo Starting Backend... && npm start"

echo.
echo Waiting 8 seconds for backend to initialize...
timeout /t 8 /nobreak >nul

echo.
echo Starting Frontend Server (Port 3001)...
echo ========================================
start "Frontend Server" cmd /k "cd /d \"E:\expense tracker\Frontend\" && echo Starting Frontend... && npm run dev"

echo.
echo ========================================
echo Both servers are starting up!
echo.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3001
echo.
echo Wait for both servers to fully start, then open:
echo http://localhost:3001
echo.
echo Login with:
echo Email: admin@techcorp.com
echo Password: password123
echo.
pause