# Deployment Instructions - CRITICAL FIXES

## What Was Fixed

1. ✅ **Strategy Activation** - Added missing database tables
2. ✅ **Admin Access** - Auto-grant admin subscription
3. ✅ **Better Error Logging** - Detailed error messages
4. ✅ **Database Schema** - Created migrations for missing tables

## IMMEDIATE ACTIONS REQUIRED

### Step 1: Run Database Migrations in Supabase

Go to Supabase Dashboard → SQL Editor and run these migrations in order:

#### Migration 014: Trading Preferences and Instruments
```sql
-- Copy and paste the entire content of:
-- supabase/migrations/014_trading_preferences_and_instruments.sql
```

#### Migration 015: Admin Users Full Access
```sql
-- Copy and paste the entire content of:
-- supabase/migrations/015_admin_users_full_access.sql
```

### Step 2: Mark Your User as Admin

Run this in Supabase SQL Editor (replace with your email):

```sql
-- Find your user ID
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Mark as admin (use the ID from above)
UPDATE profiles 
SET is_admin = true 
WHERE id = 'your-user-id-here';

-- Verify admin subscription was created
SELECT * FROM subscriptions WHERE user_id = 'your-user-id-here';
```

### Step 3: Verify Tables Exist

Run this to confirm tables were created:

```sql
-- Check trading_preferences
SELECT * FROM trading_preferences LIMIT 1;

-- Check active_trade_instruments  
SELECT * FROM active_trade_instruments LIMIT 1;

-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename IN ('trading_preferences', 'active_trade_instruments');
```

### Step 4: Test Strategy Activation

1. Go to your app
2. Try to activate a strategy
3. Check browser console for `[PWA]` or error logs
4. Check Vercel logs if still failing

## What Should Work Now

### Strategy Activation
- ✅ Activating strategy updates `trading_preferences.strategy_id`
- ✅ Adds instruments to `active_trade_instruments`
- ✅ Trading engine will pick up the strategy
- ✅ Scanner will monitor the instruments

### Admin Access
- ✅ Admin users automatically get admin subscription
- ✅ Admin users bypass all plan checks
- ✅ Admin users have access to all features

### Strategy Saving
- ✅ Strategies save correctly
- ✅ All visibility types work (private/public/invite-only)
- ✅ Clear error messages if something fails

## Troubleshooting

### If Strategy Activation Still Fails

1. Check Vercel logs for the actual error
2. Verify migrations ran successfully
3. Check if RLS policies are blocking (they shouldn't with service_role)
4. Look for error in browser console

### If Admin Access Doesn't Work

1. Verify `is_admin = true` in profiles table
2. Check if admin subscription was created
3. Clear browser cache and re-login
4. Check if `getUserPlan()` function is being called

### If Strategy Saving Fails

1. Check browser console for validation errors
2. Verify RLS policies on strategies table
3. Check Vercel logs for server errors
4. Ensure all required fields are provided

## Monitoring

After deployment, monitor:

1. **Vercel Logs**: Check for any 500 errors
2. **Supabase Logs**: Check for RLS policy violations
3. **Browser Console**: Check for client-side errors
4. **Railway Logs**: Check if trading engine picks up strategies

## Next Steps After Deployment

1. Test strategy activation end-to-end
2. Test strategy creation and saving
3. Verify admin user has all features
4. Test strategy improvement (AI/RL)
5. Monitor trading engine logs

## Files Changed

- `src/app/api/strategies/[strategyId]/activate/route.ts` - Better error handling
- `src/app/api/strategies/route.ts` - Admin check integration
- `src/lib/server/admin-check.ts` - NEW: Admin utilities
- `supabase/migrations/014_trading_preferences_and_instruments.sql` - NEW: Critical tables
- `supabase/migrations/015_admin_users_full_access.sql` - NEW: Admin access

## Support

If issues persist after following these steps:

1. Share Vercel deployment logs
2. Share Supabase SQL query results
3. Share browser console errors
4. Share specific error messages

The code is now deployed to GitHub and Vercel will auto-deploy. You MUST run the migrations in Supabase for everything to work!
