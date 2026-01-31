## Findings (Why this matters)
### Trading Readiness (Paper/Live)
- The repo currently has **multiple execution paths** for trading:
  - The **Railway trading engine** is the only path that appears capable of true paper/live execution logic end-to-end.
  - The **Next.js “StrategyExecutionEngine” path** can create paper trades but **real broker execution is a stub** (it doesn’t actually place live orders).
- Risk controls are **fragmented across multiple tables and services** (Railway engine vs Next trade engine vs Sentry/risk worker), which can lead to **inconsistent enforcement**.
- There are several **high-risk bugs/ambiguities** that can block or mis-execute live trading:
  - Sentry risk worker likely **does not decrypt api_key** but uses it, while access_token is decrypted.
  - Railway engine select mapping suggests a likely bug: `max_trades_per_day` being mapped from `daily_profit_limit`.
  - Next trade engine risk sizing treats MARKET orders as orderValue=0 (bad max-order check).
  - Global kill-switch is enforced, but per-user kill-switch enforcement is split.

### Strategy “Convert Loss-Making → Highly Profitable”
- The app can **generate / improve strategies**, but it **cannot guarantee** converting a losing strategy into a highly profitable one.
- Any “optimization” must avoid **overfitting** (especially if it tunes parameters only on recent data). The realistic goal is:
  - Improve robustness (risk-adjusted returns)
  - Reduce drawdowns
  - Reject unviable strategies
  - Provide evidence via walk-forward/backtests

## What I will do (Step-by-step)
### 1) Clean all lint warnings (repo hygiene)
- Add/expand ESLint ignore patterns so it never scans non-app code (e.g., `.venv`, nested node_modules, generated artifacts).
- Fix warnings in priority order:
  - `src/components/TradingViewChart.tsx` warnings (hooks deps, unused vars, unused imports)
  - `src/app/(protected)/analysis/page.tsx` warnings (useCallback deps etc.)
  - then the top offenders in `src/app/(protected)/strategy/page.tsx`, `scanner`, `dashboard`, `settings`.
- Goal: `npm run lint` exits clean (0 warnings).

### 2) Audit “can we safely autotrade tomorrow?” (paper + live)
- Create a short “production readiness checklist” from code, covering:
  - Single source of truth execution path (Railway engine vs Next engine)
  - Required environment variables + broker credential flows
  - Market hours gating and heartbeat gating
  - Kill switches (global + per-user)
  - PnL accounting consistency
  - Position/order sync consistency
- Mark each item as: OK / Risk / Blocker.

### 3) Fix trading blockers and consistency issues
- Ensure **one canonical execution engine** for live trading (recommend: Railway trading-engine).
- Ensure **paper mode and live mode** switch behavior is consistent end-to-end.
- Fix critical issues discovered in audit:
  - Decrypt api_key in Sentry risk worker.
  - Fix Railway trading_preferences field mapping bug.
  - Fix MARKET order value check in Next order execution risk logic.
  - Ensure per-user kill switch is enforced in the same engine that executes trades.

### 4) Strategy optimizer capability (realistic, safe)
- Audit the strategy creator / optimizer flow and ensure:
  - Improvements are validated with backtest + walk-forward split.
  - Optimizer emits “confidence / robustness” score, not just profit.
  - Add safeguards: reject strategies with low sample size, high drawdown, too few trades, unrealistic slippage.

## Verification (How I’ll prove it)
- Run:
  - `npm run build:web`
  - `npm run lint`
- Add a “paper trading smoke test” checklist:
  - Enable paper mode + auto trading
  - Confirm signal generation
  - Confirm paper order creation
  - Confirm position lifecycle and stop-loss / square-off paths
- For live mode readiness:
  - Confirm broker token validity
  - Confirm kill-switch behavior
  - Confirm max-loss/profit enforcement from the same canonical source

## Deliverables
- Clean lint report (0 warnings)
- A written audit report (OK/Risk/Blocker) with file references
- Concrete fixes for the identified blockers
- Clear answer: “Safe for paper tomorrow? Safe for live tomorrow?” with justification