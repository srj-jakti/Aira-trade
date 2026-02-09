@echo off
echo ========================================
echo  VERIFYING ALL FIXES
echo ========================================
echo.

echo [1/4] Checking Market Data Worker...
railway service market-data-worker
echo.
echo Looking for market hours detection...
railway logs | findstr /C:"MarketHours" | more +0
echo.

echo [2/4] Checking for live ticks...
railway logs | findstr /C:"Received" /C:"ticks" | more +0
echo.

echo [3/4] Checking Trading Engine...
railway service trading-engine
railway logs | findstr /C:"Evaluating" /C:"TradingEngine" | more +0
echo.

echo [4/4] Running local diagnostic...
cd ..
npm run diagnostic
echo.

echo ========================================
echo  VERIFICATION COMPLETE
echo ========================================
echo.
echo Check the output above for:
echo - [MarketHours] IST: XX:XX, IsOpen: true
echo - Received X ticks since start
echo - TradingEngine evaluating signals
echo - Diagnostic shows all green checks
echo.
pause
