@echo off
cd /d "%~dp0"
if not exist "dist\index.html" (
    echo Building frontend...
    call npm run build
    if %errorlevel% neq 0 (
        echo.
        echo Build failed. See errors above.
        pause
        exit /b %errorlevel%
    )
)
echo Starting 1C Quotation Assistant...
"%~dp0node_modules\electron\dist\electron.exe" "%~dp0"
if %errorlevel% neq 0 (
    echo.
    echo Electron exited with code %errorlevel%.
    pause
)
