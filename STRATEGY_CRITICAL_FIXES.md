# Strategy System Critical Fixes - 2026-02-11

## Issues Identified

### 1. Strategy Activation Not Connecting to Trading Engine
**Problem**: When users activate a strategy from marketplace or private strategies, it only toggles `strategies.is_active` but doesn't update `trading_preferences.strategy_id`. The trading engine reads `strategy_id` from `trading_preferences` to know which strategy to trade, causing "internal server error" and strategies not being picked up for trading.

**Root Cause**: 
- Activation endpoint: `src/app/api/strategies/[strategyId]/activate/route.ts` only updates `strategies.is_active`
- Trading engine: `railway/trading-engine/src/engine.ts` reads `trading_preferences.strategy_id`
- Missing link between activation and trading preferences

### 2. Strategy Saving Not Working (Public/Private/Invite-Only)
**Problem**: After strategy creation, saving to any visibility type (public/private/invite-only) fails silently or doesn't persist correctly.

**Root Cause**:
- Strategy creation endpoint exists but may have validation issues
- Publish endpoint requires `is_finalized` flag but creation flow might not set it
- No clear feedback on save failures

### 3. Strategy Improvement Not Working
**Problem**: "Improve" button after backtest doesn't improve strategies. AI Brain and RL Engine aren't being called or connected properly.

**Root Cause**:
- Improvement endpoint exists at `src/app/api/strategies/[strategyId]/improve/route.ts`
- Calls `aiTradingEngine.suggestStrategyImprovements()` and `strategyService.improveStrategyWithAI()`
- RL Engine integration exists but may not be properly connected
- AI Brain refinement may be failing silently

## Solutions

### Fix 1: Connect Strategy Activation to Trading Engine

**Changes Needed**:
1. Update activation endpoint to also upsert `trading_preferences.strategy_id`
2. Ensure strategy is marked as finalized before activation
3. Add proper error handling and user feedback

**Implementation**: Update `src/app/api/strategies/[strategyId]/activate/route.ts`

### Fix 2: Fix Strategy Saving Flow

**Changes Needed**:
1. Ensure strategy creation properly sets `is_finalized` and `status`
2. Fix publish endpoint to handle all visibility types correctly
3. Add proper validation and error messages
4. Ensure RLS policies allow the operations

**Implementation**: Update `src/app/api/strategies/route.ts` and `src/app/api/strategies/[strategyId]/publish/route.ts`

### Fix 3: Fix Strategy Improvement with AI/RL

**Changes Needed**:
1. Verify RL Engine URL is set and accessible
2. Add fallback when RL Engine is unavailable
3. Ensure AI Brain connection is working
4. Add detailed logging for debugging
5. Return meaningful error messages to frontend

**Implementation**: Update `src/app/api/strategies/[strategyId]/improve/route.ts` and related services

## Implementation Plan

1. Fix activation endpoint (highest priority - blocks trading)
2. Fix saving flow (high priority - blocks strategy creation)
3. Fix improvement flow (medium priority - optimization feature)
4. Test end-to-end flow
5. Deploy to production
