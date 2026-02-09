@echo off
echo ========================================
echo  DEPLOYING MARKET HOURS FIX TO RAILWAY
echo ========================================
echo.
echo This will deploy the critical market hours detection fix.
echo.
echo Current Status:
echo - Fix: Applied to code
echo - Build: Completed successfully
echo - Deploy: Needs confirmation
echo.
echo Market closes at 3:30 PM IST - Deploy NOW!
echo.
pause

cd railway\market-data-worker
echo.
echo Switching to market-data-worker service...
railway service market-data-worker

echo.
echo Redeploying with latest code...
echo.
echo IMPORTANT: Type 'y' when prompted to confirm deployment!
echo.
railway redeploy

echo.
echo ========================================
echo  DEPLOYMENT INITIATED
echo ========================================
echo.
echo Next steps:
echo 1. Wait 1-2 minutes for deployment to complete
echo 2. Run: railway logs
echo 3. Look for: [MarketHours] IST: XX:XX, IsOpen: true
echo 4. Verify ticks are being received
echo.
pause
