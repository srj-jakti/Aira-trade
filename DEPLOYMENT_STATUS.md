# 🚀 Deployment Status - Market Hours Fix

**Date:** 2026-02-09  
**Time:** Current  
**Status:** CODE COMMITTED, AWAITING RAILWAY DEPLOYMENT

---

## ✅ What's Been Done

### 1. Market Hours Detection Fix - COMMITTED
- **File:** `railway/market-data-worker/src/worker.ts`
- **Fix:** Replaced unreliable `toLocaleString()` with proper UTC offset calculation
- **Commit:** `3df1c73` - "CRITICAL FIX: Market hours detection timezone bug - Fix IST calculation"
- **Pushed to:** GitHub (github-integ remote)

### 2. Build Completed
- TypeScript compilation successful
- No build errors
- Ready for deployment

---

## ⏳ Next Steps - MANUAL ACTION REQUIRED

Railway auto-deploy may not be configured. You need to manually trigger deployment:

### Option 1: Railway Dashboard (Recommended)
1. Go to https://railway.app
2. Open project "Aira"
3. Select service "market-data-worker"
4. Click "Deploy" or "Redeploy"
5. Wait for deployment to complete (~2-3 minutes)

### Option 2: Railway CLI (If auto-deploy fails)
```bash
cd railway/market-data-worker
railway service market-data-worker
railway up
```

### Option 3: Force Redeploy via CLI
```bash
cd railway/market-data-worker
railway service market-data-worker
railway redeploy
# Type 'y' when prompted
```

---

## 🔍 Verification After Deployment

### Step 1: Check Market Detection (2 minutes)
```bash
railway service market-data-worker
railway logs
```

**Look for:**
```
[MarketHours] IST: 9:XX, Day: 1, Minutes: XXX, IsOpen: true
[MarketDataWorker] Market data enabled. Proceeding with initialization...
```

**Should NOT see:**
```
[MarketDataWorker] Worker not running but market is closed. Skipping restart.
```

### Step 2: Check WebSocket Connections (5 minutes)
```bash
railway logs | grep "Connected"
```

**Expected:**
```
[MarketDataWorker][XXX_primary] Connected
[MarketDataWorker] Received 100 ticks since start
```

### Step 3: Verify Live Data Flow
```bash
railway logs | grep "Received.*ticks"
```

**Expected:**
```
[MarketDataWorker] Received 100 ticks since start. Last at 2026-02-09T...
[MarketDataWorker] Received 200 ticks since start. Last at 2026-02-09T...
```

---

## 🚨 Current Issues Still Present

### Issue #1: Market Hours Bug
- **Status:** FIXED IN CODE, NOT YET DEPLOYED
- **Impact:** Worker thinks market is closed when it's open
- **Solution:** Deploy the committed fix

### Issue #2: WebSocket Crashes (Error 1005)
- **Status:** LIKELY CAUSED BY EXPIRED TOKENS
- **Impact:** Connections fail after brief success
- **Root Cause:** Zerodha access tokens expired
- **Solution:** After deploying market hours fix, refresh tokens

---

## 🔧 Token Refresh (Do After Deployment)

Once the market hours fix is deployed and worker starts properly, you'll likely need to refresh Zerodha tokens:

### Check Token Status
```sql
SELECT 
  name,
  token_expires_at,
  token_expires_at < NOW() as is_expired
FROM admin_zerodha_configs
WHERE is_active = true;
```

### If Tokens Expired, Refresh Them

**Option A: Wait for Auto-Login**
- Auto-login runs every few minutes
- Check logs for: `[MarketDataWorker] Auto-login successful`

**Option B: Force Refresh**
```bash
npx tsx scripts/force-auto-login.ts
```

**Option C: Manual Re-authentication**
1. Open AiRA app
2. Go to Admin → Zerodha Configs
3. Click "Re-authenticate" for each account
4. Complete login flow

---

## 📊 Expected Timeline

### After Deployment:
- **0-2 minutes:** Worker detects market as OPEN
- **2-5 minutes:** WebSocket connections established (if tokens valid)
- **5-10 minutes:** Live ticks flowing, candles aggregating
- **10+ minutes:** Trading engine operational

### If Tokens Expired:
- **+2-5 minutes:** Token refresh via auto-login
- **+5-10 minutes:** WebSocket connections established
- **+10-15 minutes:** Full system operational

---

## 🎯 Success Criteria

- [ ] Market hours detection shows "IsOpen: true" during trading hours
- [ ] No more "market closed" messages during 9:15 AM - 3:30 PM IST
- [ ] WebSocket connections stable (no 1005 errors)
- [ ] Live ticks being received continuously
- [ ] Candles being aggregated in database
- [ ] Trading engine evaluating strategies

---

## 📞 If Issues Persist

### Market Still Shows Closed After Deployment
1. Verify deployment completed: Check Railway dashboard
2. Check actual IST time: Is it 9:15 AM - 3:30 PM Mon-Fri?
3. Check logs for debug output with IST time
4. Verify new code is running (look for debug log format)

### WebSocket Still Crashing After Token Refresh
1. Check Zerodha API status: https://api.kite.trade/
2. Verify API keys are valid in Zerodha Developer Console
3. Check for rate limiting
4. Increase connection timeout from 30s to 60s

### No Ticks Received After Everything
1. Check Redis connection
2. Verify Supabase connection
3. Check subscription manager loaded instruments
4. Verify WebSocket subscriptions were sent

---

## 📝 Summary

**What's Ready:**
- ✅ Market hours fix coded and committed
- ✅ Build successful
- ✅ Code pushed to GitHub

**What's Needed:**
- ⏳ Manual deployment trigger on Railway
- ⏳ Token refresh (likely needed)
- ⏳ Verification of live data flow

**Estimated Time to Full Operation:**
- 5-10 minutes if tokens are valid
- 15-20 minutes if tokens need refresh

---

**Next Action:** Deploy via Railway Dashboard or CLI, then verify logs show market as OPEN.
