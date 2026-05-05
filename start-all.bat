@echo off
title Expense Tracker - Full Stack Startup
echo ========================================
echo    EXPENSE TRACKER FULL STACK STARTUP
echo ========================================
echo.

echo Starting Backend Server...
echo ========================================
start "Backend Server" cmd /k "cd /d \"E:\expense tracker\Backend\" && npm start"

echo.
echo Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak > nul

echo.
echo Starting Frontend Server...
echo ========================================
start "Frontend Server" cmd /k "cd /d \"E:\expense tracker\Frontend\" && npm run dev"

echo.
echo ========================================
echo Both servers are starting up!
echo.
echo Backend will be available at: http://localhost:5000
echo Frontend will be available at: http://localhost:3001
echo.
echo Wait for both servers to fully start, then open:
echo http://localhost:3001
echo.
pause