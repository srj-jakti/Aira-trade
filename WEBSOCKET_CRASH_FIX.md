# 🔴 CRITICAL: Market Data Worker WebSocket Crash

**Date:** 2026-02-09 14:15 IST  
**Status:** CRASHED - WebSocket connections failing  
**Error Code:** 1005 (Abnormal Closure)

---

## 🚨 Problem Analysis

### What's Happening:
```
[MarketDataWorker][XXX_primary] Connection timeout
[MarketDataWorker][XXX_primary] Disconnected: 1005
[MarketDataWorker][XXX_primary] Max reconnect attempts reached
```

### Root Causes (in order of likelihood):

#### 1. **Zerodha Access Tokens Expired** (Most Likely)
- Zerodha access tokens expire daily at end of trading day
- Tokens need to be refreshed every day
- Worker is trying to connect with expired tokens

#### 2. **API Credentials Invalid**
- API keys might be incorrect
- Credentials might have been revoked

#### 3. **Network/Firewall Issues**
- Railway might be blocking WebSocket connections
- Zerodha might be rate-limiting

---

## 🔧 Immediate Fixes

### Fix #1: Refresh Zerodha Access Tokens (MOST LIKELY FIX)

**Step 1: Check Token Expiry**
```sql
-- Run in Supabase SQL Editor
SELECT 
  name,
  connection_status,
  token_expires_at,
  token_expires_at < NOW() as is_expired,
  last_error
FROM admin_zerodha_configs
WHERE is_active = true
ORDER BY name;
```

**Step 2: If Tokens Expired, Refresh Them**

Option A: **Use Auto-Login (Recommended)**
```bash
# The worker has auto-login enabled
# Just wait for the next auto-login cycle (runs every few minutes)
# Check logs for:
railway logs | grep "Auto-login"
```

Option B: **Manual Login via App**
1. Go to your AiRA app
2. Navigate to Admin → Zerodha Configs
3. Click "Re-authenticate" for each account
4. Complete the login flow

Option C: **Force Auto-Login Script**
```bash
# Run the force auto-login script
npx tsx scripts/force-auto-login.ts
```

### Fix #2: Check API Credentials

**Verify in Supabase:**
```sql
SELECT 
  name,
  api_key,
  connection_status,
  last_error
FROM admin_zerodha_configs
WHERE is_active = true;
```

**If credentials are wrong:**
1. Go to Zerodha Developer Console
2. Regenerate API keys
3. Update in AiRA app

### Fix #3: Increase Connection Timeout

**Edit:** `railway/market-data-worker/src/worker.ts`

Find the connection timeout (line ~30):
```typescript
setTimeout(() => {
  if (!connection.isConnected) {
    console.warn(`[MarketDataWorker][${websocketId}] Connection timeout`);
    // ...
  }
}, 30000); // 30 seconds
```

**Change to 60 seconds:**
```typescript
}, 60000); // 60 seconds - give more time for slow connections
```

---

## 🎯 Quick Fix (Do This Now)

### Option 1: Wait for Auto-Login (Easiest)
The worker has auto-login enabled. Just wait 2-3 minutes and check logs:

```bash
railway service market-data-worker
railway logs | grep "Auto-login"
```

Look for:
```
[MarketDataWorker] Auto-login check executing
[MarketDataWorker] Auto-login running in worker for: Account 1, ACCOUNT 3
[MarketDataWorker] Auto-login successful for Account 1
```

### Option 2: Force Refresh Tokens (Fastest)
```bash
npx tsx scripts/force-auto-login.ts
```

### Option 3: Manual Re-authentication
1. Open AiRA app
2. Go to Admin → Zerodha Configs
3. Click "Re-authenticate" for each account
4. Complete login flow

---

## 📊 Verification

After fixing, check logs for successful connection:

```bash
railway logs | grep "Connected"
```

**Expected:**
```
[MarketDataWorker][XXX_primary] Connected
[MarketDataWorker] Resubscribing X tokens
[MarketDataWorker] Received 100 ticks since start
```

---

## 🔍 Detailed Error Analysis

### Error Code 1005 Meaning:
- **1005:** No status code was provided even though one was expected
- **Common Causes:**
  - Authentication failure (expired tokens)
  - Invalid credentials
  - Server rejected connection
  - Network issues

### Connection Flow:
```
1. Worker starts
2. Loads API credentials from database
3. Decrypts credentials
4. Creates WebSocket connection
5. ❌ Connection times out (30 seconds)
6. ❌ Disconnects with code 1005
7. ❌ Retries 5 times
8. ❌ Max reconnect attempts reached
9. ❌ Marks config as error in database
```

### Why It's Failing:
- **Most Likely:** Zerodha access tokens expired (they expire daily)
- **Solution:** Refresh tokens via auto-login or manual re-auth

---

## 🚀 Prevention

### Enable Daily Token Refresh

**Option 1: Cron Job (Recommended)**
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/refresh-zerodha-tokens",
    "schedule": "0 8 * * *"
  }]
}
```

**Option 2: Railway Cron**
Add to Railway:
```bash
railway run --cron "0 8 * * *" npx tsx scripts/refresh-tokens.js
```

**Option 3: Auto-Login (Already Enabled)**
The worker already has auto-login enabled. It should refresh tokens automatically.

---

## 🔧 Additional Debugging

### Check Zerodha API Status
```bash
curl https://api.kite.trade/
```

### Check Token Expiry Times
```sql
SELECT 
  name,
  token_expires_at,
  EXTRACT(EPOCH FROM (token_expires_at - NOW())) / 3600 as hours_until_expiry
FROM admin_zerodha_configs
WHERE is_active = true;
```

### Check Recent Errors
```sql
SELECT 
  name,
  last_error,
  updated_at
FROM admin_zerodha_configs
WHERE is_active = true
ORDER BY updated_at DESC;
```

---

## 📋 Action Plan

### Immediate (Next 5 minutes):
1. **Check if tokens expired:**
   ```sql
   SELECT name, token_expires_at < NOW() as expired 
   FROM admin_zerodha_configs 
   WHERE is_active = true;
   ```

2. **If expired, refresh tokens:**
   - Wait for auto-login (2-3 minutes), OR
   - Run: `npx tsx scripts/force-auto-login.ts`, OR
   - Manual re-auth in app

3. **Verify connection:**
   ```bash
   railway logs | grep "Connected"
   ```

### Short Term (Today):
4. **Increase connection timeout** to 60 seconds
5. **Set up daily token refresh** cron job
6. **Monitor for stability**

### Long Term (This Week):
7. **Add token expiry alerts**
8. **Implement automatic token refresh**
9. **Add connection retry with exponential backoff**

---

## 💡 Why This Happened

### Timeline:
1. **Yesterday (2026-01-27):** System was working fine
2. **Today (2026-02-09):** 13 days later, tokens expired
3. **Result:** WebSocket connections failing

### Zerodha Token Lifecycle:
- Access tokens expire at **end of trading day** (3:30 PM IST)
- Need to re-authenticate **every day**
- Auto-login should handle this, but might have failed

---

## 🎯 Expected Results

### After Token Refresh:
- ✅ WebSocket connections successful
- ✅ Live ticks flowing
- ✅ No more 1005 errors
- ✅ Worker stable

### Logs Should Show:
```
[MarketDataWorker][XXX_primary] Connected
[MarketDataWorker] Resubscribing 2 tokens in PRIORITY ORDER
[MarketDataWorker] Received 100 ticks since start
[MarketDataWorker] Received 200 ticks since start
```

---

## 🚨 If Still Failing After Token Refresh

### Check These:

1. **API Keys Valid?**
   - Go to Zerodha Developer Console
   - Verify API keys are active
   - Check if app is approved

2. **Network Issues?**
   - Test from local machine
   - Check Railway network status
   - Verify Zerodha API is up

3. **Rate Limiting?**
   - Check if hitting Zerodha rate limits
   - Reduce connection attempts
   - Add delays between retries

---

**Report Generated:** 2026-02-09 14:15 IST  
**Priority:** 🔴 CRITICAL  
**Action:** Refresh Zerodha access tokens NOW  
**ETA:** 2-5 minutes after token refresh
