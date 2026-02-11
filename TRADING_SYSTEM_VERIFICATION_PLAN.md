# Trading System Verification Plan

## Overview
Now that all 20 strategies are created, we need to verify the complete automated trading system before users connect their accounts.

## System Components to Verify

### 1. Strategy Activation ✅ (Already Fixed)
- [x] Strategy activation updates `trading_preferences.strategy_id`
- [x] Instruments sync to `active_trade_instruments`
- [x] UUID conversion for strategy IDs
- [x] Fork handling for public strategies

### 2. Balance Detection (Needs Verification)
**Location**: `railway/trading-engine/src/executor.ts`

**What to Check**:
- [ ] Zerodha API integration for balance fetching
- [ ] Balance caching mechanism
- [ ] Balance refresh frequency
- [ ] Error handling for API failures
- [ ] Fallback for unavailable balance

**Test Cases**:
```typescript
// 1. Fetch balance from Zerodha
// 2. Verify balance is stored correctly
// 3. Test with expired token
// 4. Test with invalid credentials
// 5. Verify balance updates after trades
```

### 3. Daily P&L Tracking (Partially Implemented)
**Location**: `railway/trading-engine/src/engine.ts`, `trading_preferences` table

**What to Check**:
- [x] `daily_pnl_realized` field exists
- [ ] P&L updates after each trade
- [ ] P&L resets at market open (9:15 AM IST)
- [ ] Profit limit enforcement
- [ ] Loss limit enforcement
- [ ] Auto-disable when limits hit

**Database Function Needed**:
```sql
CREATE OR REPLACE FUNCTION increment_daily_pnl(
  user_id_val UUID,
  pnl_val DECIMAL
) RETURNS VOID AS $$
BEGIN
  UPDATE trading_preferences
  SET daily_pnl_realized = daily_pnl_realized + pnl_val,
      updated_at = NOW()
  WHERE user_id = user_id_val;
END;
$$ LANGUAGE plpgsql;
```

### 4. Scanner Integration (Needs Implementation)
**Expected Location**: `railway/trading-engine/src/scanner.ts` (MISSING!)

**What Needs to Be Built**:
- [ ] Scanner reads from `active_trade_instruments`
- [ ] Real-time market data fetching
- [ ] Signal generation based on strategy rules
- [ ] Signal quality scoring
- [ ] Signal storage in database

**Scanner Flow**:
```
1. Read active instruments from active_trade_instruments
2. Fetch latest candles for each instrument
3. For each user with active strategy:
   a. Load strategy rules
   b. Evaluate rules against candles
   c. Generate BUY/SELL signals
   d. Store signals in signals table
4. Trading engine picks up signals and executes
```

### 5. Order Execution (Partially Implemented)
**Location**: `railway/trading-engine/src/executor.ts`

**What to Check**:
- [ ] Order placement via Zerodha API
- [ ] Paper trading mode
- [ ] Position sizing based on balance
- [ ] Stop loss placement
- [ ] Target placement
- [ ] Order status tracking
- [ ] Error handling and retries

### 6. Risk Management (Partially Implemented)
**Location**: `railway/trading-engine/src/engine.ts`, `evaluator.ts`

**What to Check**:
- [x] Daily loss limit check
- [x] Daily profit limit check
- [ ] Max trades per day enforcement
- [ ] Position sizing validation
- [ ] Risk per trade calculation
- [ ] Kill switch functionality
- [ ] Volatility-based trade blocking

### 7. Position Tracking (Needs Verification)
**Location**: Database `positions` table

**What to Check**:
- [ ] Position creation on order fill
- [ ] Position updates on price changes
- [ ] Trailing stop loss activation
- [ ] Position closure on SL/Target hit
- [ ] P&L calculation
- [ ] Position history logging

### 8. Daily Limit Resets (Needs Implementation)
**What Needs to Be Built**:
- [ ] Cron job to reset daily limits at 9:00 AM IST
- [ ] Reset `daily_pnl_realized` to 0
- [ ] Reset `daily_trades_count` to 0
- [ ] Re-enable auto_trading if quota was hit
- [ ] Clear `daily_quota_hit_at` and `daily_quota_reason`

**Cron Job Needed**:
```typescript
// Reset daily limits at 9:00 AM IST
async function resetDailyLimits() {
  await supabase
    .from('trading_preferences')
    .update({
      daily_pnl_realized: 0,
      daily_trades_count: 0,
      daily_quota_hit_at: null,
      daily_quota_reason: null,
      auto_trading_enabled: true, // Re-enable if was auto-disabled
      updated_at: new Date().toISOString()
    })
    .not('user_id', 'is', null);
}
```

## Critical Missing Components

### 1. Scanner Service (HIGH PRIORITY)
The scanner is the bridge between strategies and trading engine. Without it, no signals are generated.

**Required Implementation**:
- Create `railway/trading-engine/src/scanner.ts`
- Implement real-time market data fetching
- Implement strategy rule evaluation
- Implement signal generation and storage
- Deploy as separate Railway service

### 2. Daily Reset Cron (HIGH PRIORITY)
Without daily resets, users will be stuck after hitting limits.

**Required Implementation**:
- Create API endpoint `/api/cron/reset-daily-limits`
- Protect with `CRON_SECRET`
- Schedule via Railway cron or external service
- Run at 9:00 AM IST daily

### 3. Balance Sync Service (MEDIUM PRIORITY)
Balance needs to be synced regularly from Zerodha.

**Required Implementation**:
- Create `/api/cron/sync-balances`
- Fetch balance for all active users
- Update `trading_preferences.available_balance`
- Run every 5 minutes during market hours

## Verification Checklist

### Pre-Trading Checks
- [ ] User connects Zerodha account
- [ ] API credentials stored securely (encrypted)
- [ ] Balance fetched correctly
- [ ] Trading preferences initialized
- [ ] Strategy activated successfully
- [ ] Instruments added to scanner

### During Trading
- [ ] Scanner detects opportunities
- [ ] AI analyzes and generates signals
- [ ] Strategy rules evaluated correctly
- [ ] Orders placed with correct parameters
- [ ] Stop loss and targets set
- [ ] Positions tracked in real-time
- [ ] P&L calculated correctly
- [ ] Daily limits enforced

### Post-Trading
- [ ] Daily P&L updated
- [ ] Positions squared off (intraday)
- [ ] Trading limits reset next day
- [ ] Performance metrics logged
- [ ] Trade history stored

## Testing Strategy

### Phase 1: Paper Trading (1-2 days)
1. Enable paper trading for all users
2. Monitor signal generation
3. Verify order placement logic
4. Check P&L calculations
5. Test limit enforcement

### Phase 2: Limited Live Trading (3-5 days)
1. Allow 5-10 beta users to trade live
2. Start with small position sizes
3. Monitor closely for issues
4. Collect feedback
5. Fix any bugs found

### Phase 3: Full Rollout (After successful testing)
1. Enable for all users
2. Monitor system performance
3. Track success metrics
4. Iterate based on feedback

## Success Metrics

### System Performance
- Order execution < 1 second
- Signal generation < 2 seconds
- Balance sync < 5 seconds
- System uptime > 99.9%
- Error rate < 0.1%

### Strategy Performance
- Win rate > 50%
- Profit factor > 1.5
- Max drawdown < 15%
- Sharpe ratio > 1.0
- Risk/reward > 1:1.5

## Next Steps

1. **Immediate (Today)**:
   - Create scanner service
   - Implement daily reset cron
   - Test balance fetching

2. **Short-term (This Week)**:
   - Deploy scanner to Railway
   - Set up cron jobs
   - Test with paper trading
   - Fix any issues found

3. **Medium-term (Next Week)**:
   - Beta test with live trading
   - Monitor and optimize
   - Create user documentation
   - Prepare for full rollout

## Risk Mitigation

### Safety Measures
1. **Paper Trading Default**: All new users start with paper trading
2. **Conservative Limits**: Default to low risk limits
3. **Kill Switch**: Users can instantly disable trading
4. **Circuit Breakers**: Auto-disable on unusual activity
5. **Audit Logging**: Log all trading decisions

### Monitoring
1. **Real-time Alerts**: Notify on errors or unusual activity
2. **Performance Dashboard**: Track key metrics
3. **User Feedback**: Collect and act on user reports
4. **System Health**: Monitor Railway services
5. **Database Performance**: Track query times

---

**Status**: Strategies created ✅, Trading system needs verification ⚠️
**Priority**: HIGH - Users will start connecting accounts soon
**Timeline**: Complete verification within 2-3 days
