# Trading Engine Critical Fixes Applied

## Date: 2026-02-11

## Issues Fixed

### 1. ✅ Strategy Column Name Mismatch (CRITICAL)

**Problem**: Trading engine code was referencing wrong column names from the `strategies` table.

**Root Cause**: 
- Code used: `strategy.timeframe` (string) and `strategy.instruments` (array)
- Actual columns: `selected_timeframes` (array) and `selected_instruments` (array)

**Impact**: 
- Trading engine couldn't properly fetch strategy data
- No signals were being generated
- System appeared to work but did nothing

**Fix Applied**:
1. Updated `Strategy` interface in `railway/trading-engine/src/evaluator.ts`:
   - Changed `timeframe: string` → `selected_timeframes: string[]`
   - Changed `instruments: number[]` → `selected_instruments: number[]`

2. Updated code in `railway/trading-engine/src/evaluator.ts`:
   - Extract first timeframe from `selected_timeframes` array
   - Added fallback to "5m" if array is empty

3. Updated code in `railway/trading-engine/src/engine.ts` (2 locations):
   - Use `selected_instruments` array instead of `instruments`
   - Extract first timeframe from `selected_timeframes` array
   - Added fallback to "5m" if array is empty

**Files Modified**:
- `railway/trading-engine/src/evaluator.ts`
- `railway/trading-engine/src/engine.ts`

---

## Remaining Issues to Fix

### 2. ⚠️ Execution Lock Stuck (HIGH PRIORITY)

**Problem**: One user has `execution_lock = true` and is stuck.

**User ID**: `6a01d9d0-d331-410b-a514-27b2c01cb211`

**Fix Required**: Release the execution lock via SQL update.

### 3. ⚠️ Invalid Strategy IDs (HIGH PRIORITY)

**Problem**: Users have invalid `strategy_id` values in `trading_preferences` table.

**Current State**:
- Users have strategy_id values that don't match any existing strategies
- Valid strategy IDs are: 6, 8, 9, 10, 11

**Fix Required**: Update users' `strategy_id` to valid values.

### 4. ⚠️ Frontend Strategy Selection (MEDIUM PRIORITY)

**Problem**: Frontend may still be using UUID for strategy selection.

**Fix Required**: Update frontend components to use bigint strategy IDs.

---

## Testing Plan

### Phase 1: Verify Fixes
1. ✅ Code changes applied and compiled without errors
2. ⏳ Release stuck execution lock
3. ⏳ Update users with valid strategy IDs
4. ⏳ Deploy to Railway
5. ⏳ Monitor logs for strategy fetching

### Phase 2: Test Signal Generation
1. ⏳ Monitor `ai_signals` table for new signals
2. ⏳ Verify signals have correct strategy data
3. ⏳ Check that timeframe and instruments are properly extracted

### Phase 3: Test Trade Execution
1. ⏳ Enable one test user with paper trading
2. ⏳ Verify trades execute correctly
3. ⏳ Monitor position tracking
4. ⏳ Verify P&L calculations

### Phase 4: Production Rollout
1. ⏳ Enable for all users with paper trading
2. ⏳ Monitor for 1 hour
3. ⏳ Enable live trading for users who opt-in
4. ⏳ Continuous monitoring

---

## Deployment Instructions

### 1. Commit Changes
```bash
git add railway/trading-engine/src/evaluator.ts railway/trading-engine/src/engine.ts
git commit -m "fix: correct strategy column names (selected_timeframes, selected_instruments)"
git push origin main
```

### 2. Release Stuck Lock (via Supabase SQL)
```sql
UPDATE trading_preferences 
SET execution_lock = false,
    evaluation_error = NULL
WHERE user_id = '6a01d9d0-d331-410b-a514-27b2c01cb211';
```

### 3. Update Invalid Strategy IDs (via Supabase SQL)
```sql
-- First, check current state
SELECT user_id, strategy_id, auto_trading_enabled 
FROM trading_preferences 
WHERE auto_trading_enabled = true;

-- Update to a valid strategy (e.g., strategy 8: "Aira Intraday Pulse")
UPDATE trading_preferences 
SET strategy_id = 8
WHERE auto_trading_enabled = true 
AND strategy_id IS NOT NULL;
```

### 4. Railway Deployment
The trading-engine service will automatically redeploy when changes are pushed to GitHub.

Monitor deployment:
```bash
# Check Railway logs
railway logs -s trading-engine
```

---

## Expected Behavior After Fix

### Trading Engine Should:
1. ✅ Successfully fetch strategy data from database
2. ✅ Extract timeframe from `selected_timeframes[0]`
3. ✅ Extract instruments from `selected_instruments` array
4. ✅ Generate signals based on strategy rules
5. ✅ Execute trades for users with auto-trading enabled
6. ✅ Track positions and P&L correctly

### Monitoring Points:
- `ai_signals` table should start receiving new signals
- `trading_engine_status` should show active users
- `user_positions` / `paper_positions` should show new positions
- Railway logs should show successful strategy evaluations

---

## Success Criteria

- [ ] No more "Strategy not found" errors in logs
- [ ] Signals being generated in `ai_signals` table
- [ ] Trades executing for paper trading users
- [ ] Trades executing for live trading users
- [ ] Positions being tracked correctly
- [ ] P&L calculations working
- [ ] No execution locks stuck
- [ ] All users with valid strategy IDs

---

## Rollback Plan

If issues persist after deployment:

1. Disable auto-trading for all users:
```sql
UPDATE trading_preferences SET auto_trading_enabled = false;
```

2. Revert code changes:
```bash
git revert HEAD
git push origin main
```

3. Investigate further and apply additional fixes

---

## Notes

- The schema mismatch was the root cause of the "no trades" issue
- This fix is critical and must be deployed immediately
- After deployment, monitor closely for 1-2 hours
- Users should start seeing trades within 15-30 minutes of deployment
