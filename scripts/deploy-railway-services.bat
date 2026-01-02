@echo off
set RAILWAY_TOKEN=dd2726f4-9212-46d1-afde-5cba75a3b7bc

echo Deploying Market Data Worker...
cd /d C:\Users\shara\orchids-projects\orchids-aira-trading-app\railway\market-data-worker
railway link 9471039d-b75a-40cf-bb76-092f45f5c669 --service market-data-worker
railway up

echo Deploying Trading Engine...
cd /d C:\Users\shara\orchids-projects\orchids-aira-trading-app\railway\trading-engine
railway link 9471039d-b75a-40cf-bb76-092f45f5c669 --service trading-engine
railway up

echo Done!
