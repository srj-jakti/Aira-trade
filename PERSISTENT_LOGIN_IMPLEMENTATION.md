# Persistent Zerodha Login Implementation

## Overview
Implemented automatic token refresh system for user accounts, eliminating the need for daily manual re-authentication. Users can now enable auto-login and their Zerodha sessions will be automatically refreshed, allowing AI trading to continue seamlessly.

## Changes Made

### 1. Database Migration
- Added `auto_login_enabled` column to `user_broker_accounts` table
- Allows users to opt-in to automatic session refresh

### 2. Backend Services

#### User Zerodha Service (`src/lib/server/user-zerodha-service.ts`)
- **getUserAccessToken()**: Retrieves valid token for user, auto-refreshes if expired
- **attemptAutoLogin()**: Performs full Zerodha login using stored credentials
- **refreshExpiredUserTokens()**: Batch refresh for all users with expired tokens
- **enableAutoLogin()** / **disableAutoLogin()**: Toggle auto-login per user
- Self-healing: Automatically refreshes tokens on-demand when API calls are made

#### Cron Job API (`src/app/api/cron/refresh-user-tokens/route.ts`)
- Background job to refresh all expired user tokens
- Protected with `CRON_SECRET` authentication
- Processes accounts with 2-second delays to avoid rate limiting
- Returns success/failure counts

#### User API (`src/app/api/user/broker/auto-login/route.ts`)
- **POST**: Enable/disable auto-login for current user
- **GET**: Check auto-login status and token expiry
- Validates that required credentials exist before enabling

### 3. Frontend UI

#### Updated ApiKeysForm (`src/app/(protected)/settings/ApiKeysForm.tsx`)
- Added auto-login toggle switch (visible when connected)
- Shows status messages explaining what auto-login does
- Real-time feedback when toggling the setting
- Loads auto-login status on component mount

### 4. Updated Callback Route
- Now sets `token_expires_at` for user accounts (was missing)
- Ensures proper token expiration tracking

## How It Works

### For Users:
1. User connects Zerodha and saves credentials (user_id, password, TOTP secret)
2. User enables auto-login toggle in Settings
3. System automatically refreshes tokens before expiry
4. AI trading continues seamlessly without re-authentication

### Token Refresh Flow:
1. **On-Demand**: When user makes API calls, system checks token validity
   - If expired and auto-login enabled → automatic refresh
   - If successful → returns fresh token
   - If failed → logs error and notifies user

2. **Scheduled**: Cron job runs daily (before market opens)
   - Finds all users with expired tokens and auto-login enabled
   - Refreshes each account sequentially
   - Logs success/failure for monitoring

### Security:
- All credentials stored encrypted in database
- Auto-login requires explicit user opt-in
- Uses same secure login flow as admin accounts
- CRON_SECRET protects background refresh endpoint

## Railway Cron Setup

### Add Cron Job to Railway:

1. **Go to Railway Dashboard** → Your Project → Cron Service (or create new)

2. **Add Environment Variable**:
   ```
   CRON_SECRET=<your-secret-key>
   ```

3. **Configure Cron Schedule**:
   - **URL**: `https://your-app.vercel.app/api/cron/refresh-user-tokens`
   - **Method**: GET
   - **Headers**: 
     ```
     Authorization: Bearer <CRON_SECRET>
     ```
   - **Schedule**: `0 8 * * *` (8 AM IST daily, before market opens)
   - Alternative: `0 2 * * *` (2:30 AM UTC = 8 AM IST)

4. **Test the Endpoint**:
   ```bash
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
        https://your-app.vercel.app/api/cron/refresh-user-tokens
   ```

### Alternative: Use Railway's Built-in Cron

Create `railway.json` in project root:
```json
{
  "crons": [
    {
      "name": "refresh-user-tokens",
      "schedule": "0 2 * * *",
      "command": "curl -H 'Authorization: Bearer $CRON_SECRET' https://your-app.vercel.app/api/cron/refresh-user-tokens"
    }
  ]
}
```

## Testing

### Test Auto-Login Flow:

1. **Enable Auto-Login**:
   ```bash
   curl -X POST https://your-app.vercel.app/api/user/broker/auto-login \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer <user-token>" \
        -d '{"enabled": true}'
   ```

2. **Check Status**:
   ```bash
   curl https://your-app.vercel.app/api/user/broker/auto-login \
        -H "Authorization: Bearer <user-token>"
   ```

3. **Manually Trigger Refresh**:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
        https://your-app.vercel.app/api/cron/refresh-user-tokens
   ```

### Test in UI:

1. Go to Settings → API Keys
2. Connect to Zerodha
3. Toggle "Auto-Login" switch
4. Verify status messages appear
5. Wait for token to expire (or manually expire in DB)
6. Make an API call that requires Zerodha token
7. Verify automatic refresh happens

## Monitoring

### Check Logs:
- Look for `[UserZerodhaService]` prefix in logs
- Success: "Auto-login SUCCESS for user {userId}"
- Failure: "Auto-login FAILED for user {userId}: {error}"

### Database Queries:

```sql
-- Check users with auto-login enabled
SELECT user_id, is_connected, token_expires_at, auto_login_enabled, last_error
FROM user_broker_accounts
WHERE broker = 'zerodha' AND auto_login_enabled = true;

-- Check expired tokens
SELECT user_id, token_expires_at, auto_login_enabled
FROM user_broker_accounts
WHERE broker = 'zerodha' 
  AND (token_expires_at IS NULL OR token_expires_at < NOW());

-- Check recent connection errors
SELECT user_id, last_error, updated_at
FROM user_broker_accounts
WHERE broker = 'zerodha' AND last_error IS NOT NULL
ORDER BY updated_at DESC;
```

## Benefits

1. **Seamless Trading**: AI trading continues without interruption
2. **User Convenience**: No daily manual login required
3. **Self-Healing**: Automatic recovery from expired tokens
4. **Opt-In**: Users control whether to enable auto-login
5. **Secure**: All credentials encrypted, explicit user consent required

## Next Steps

1. ✅ Database migration applied
2. ✅ Backend services implemented
3. ✅ Frontend UI added
4. ⏳ **Deploy to production**
5. ⏳ **Configure Railway cron job**
6. ⏳ **Test with real user accounts**
7. ⏳ **Monitor logs for first few days**

## Files Changed

- `supabase/migrations/` - Added auto_login_enabled column
- `src/lib/server/user-zerodha-service.ts` - New service for user token management
- `src/app/api/cron/refresh-user-tokens/route.ts` - Cron job endpoint
- `src/app/api/user/broker/auto-login/route.ts` - User API for toggle
- `src/app/api/user/broker/callback/route.ts` - Added token_expires_at
- `src/app/(protected)/settings/ApiKeysForm.tsx` - Added auto-login UI

## Troubleshooting

### Auto-Login Not Working:
1. Check if user has all required credentials (user_id, password, totp_secret)
2. Verify credentials are encrypted properly
3. Check logs for specific error messages
4. Ensure TOTP secret is valid Base32 format

### Cron Job Not Running:
1. Verify CRON_SECRET is set correctly
2. Check Railway cron configuration
3. Test endpoint manually with curl
4. Check Railway logs for cron execution

### Token Still Expiring:
1. Verify auto_login_enabled is true in database
2. Check if cron job is running daily
3. Verify token_expires_at is being set correctly
4. Check for rate limiting issues (2-second delay between accounts)
