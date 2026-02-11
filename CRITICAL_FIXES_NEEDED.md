# Critical Issues to Fix - 2026-02-11

## Issues Reported

1. **Strategy Activation Still Showing Internal Server Error**
   - User reports activation still fails
   - Need to check actual error in production logs
   - Possible RLS policy issue or missing table columns

2. **Strategy Saving Not Working**
   - Strategies not persisting after creation
   - Need to verify database permissions and RLS policies

3. **AI Improvement Making Trades Zero**
   - Improvement is removing all trades instead of optimizing
   - Need better logic to preserve profitable patterns
   - Should auto-backtest and iterate until profitable

4. **Admin Users Should Have All Plans Access**
   - Admin users should automatically get all features
   - Need to check subscription logic for admin users

## Root Causes Analysis

### 1. Activation Error
Possible causes:
- `trading_preferences` table might not exist or have wrong schema
- `active_trade_instruments` table might not exist
- RLS policies blocking service_role operations
- Missing columns in strategies table

### 2. Strategy Saving
Possible causes:
- RLS policies too restrictive
- Missing required fields
- Validation failing silently

### 3. AI Improvement Issues
Current logic:
- Uses AI to suggest improvements
- Doesn't validate that improvements actually improve performance
- No iterative refinement
- No automatic backtesting loop

Needed:
- Validate improvements increase win rate
- Auto-backtest after each improvement
- Iterate until profitable or max iterations reached
- Preserve winning patterns

### 4. Admin Access
Current: Admin users need subscription
Needed: Admin users bypass subscription checks

## Solutions Required

### Fix 1: Add Error Logging and Validation
- Add detailed console.error with full error objects
- Return error details in response for debugging
- Check if tables exist before operations

### Fix 2: Verify Database Schema
- Ensure `trading_preferences` has `strategy_id` column
- Ensure `active_trade_instruments` table exists
- Check RLS policies allow service_role

### Fix 3: Improve AI Improvement Logic
- Add validation: new strategy must have >= trades and >= win rate
- Add auto-backtest loop
- Iterate up to 5 times
- Return best performing version
- Never return strategy with 0 trades

### Fix 4: Admin Subscription Bypass
- Check if user is admin before subscription checks
- Grant admin plan automatically to admin users
- Add admin check utility function

## Implementation Priority

1. Fix activation error (CRITICAL - blocks all trading)
2. Fix admin access (HIGH - blocks testing)
3. Fix strategy saving (HIGH - blocks strategy creation)
4. Improve AI improvement logic (MEDIUM - optimization feature)
