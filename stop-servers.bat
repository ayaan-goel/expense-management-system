@echo off
title Stop Expense Tracker Servers
echo ========================================
echo    STOPPING EXPENSE TRACKER SERVERS
echo ========================================
echo.

echo Terminating all Node.js processes...
taskkill /f /im node.exe

echo.
echo All servers stopped!
echo.
pause