@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo               LyricSync - 1-Click Publisher
echo ========================================================
echo.
echo [1/4] Scanning your songs and rebuilding the tracker database...
node scripts/build-static.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to build database! Check the error above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/4] Staging changes for Git...
git add .

echo.
echo [3/4] Committing changes...
set /p "CUSTOM_MSG=Enter a commit note (or press Enter to use default): "
if "!CUSTOM_MSG!"=="" (
    set "CUSTOM_MSG=Update songs archive and sync tracker"
)
git commit -m "!CUSTOM_MSG!"
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] No new changes to commit.
)

echo.
echo [4/4] Pushing to GitHub...
git push
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Git push failed. Please check your internet connection or git login.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo    SUCCESS! Your new songs and tracker are published!
echo.
echo    Your website on GitHub Pages will update in ~1 minute.
echo    (No browser cache clearing needed anymore!)
echo ========================================================
echo.
pause
