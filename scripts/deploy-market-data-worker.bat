@echo off
echo ========================================
echo Deploying Market Data Worker to Railway
echo ========================================
echo.

cd railway\market-data-worker

echo Step 1: Building TypeScript...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    exit /b 1
)
echo Build successful!
echo.

echo Step 2: Linking to Railway service...
call railway service market-data-worker
if %ERRORLEVEL% NEQ 0 (
    echo Failed to link service!
    exit /b 1
)
echo.

echo Step 3: Deploying to Railway...
echo Please confirm deployment when prompted (type 'y')
call railway up
if %ERRORLEVEL% NEQ 0 (
    echo Deployment failed!
    exit /b 1
)

echo.
echo ========================================
echo Deployment Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Check logs: railway logs
echo 2. Look for: [MarketHours] IST: XX:XX, IsOpen: true
echo 3. Verify ticks: railway logs ^| findstr "Received.*ticks"
echo.

cd ..\..
