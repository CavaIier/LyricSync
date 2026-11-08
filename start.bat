@echo off
title LyricSync - Juice WRLD Lyrics & LRC Engine
echo ===================================================
echo   Starting LyricSync Server...
echo ===================================================
timeout /t 1 /nobreak >nul
start "" "http://localhost:3000"
node server.js
pause
