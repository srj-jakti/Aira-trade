## Current Reality (Audit)
- Repo contains 4 Railway workers + 1 Python RL service under `railway/`: `trading-engine`, `market-data-worker`, `cron-maintenance`, `rl-engine`, plus root `aira-brain` worker defined in root [railway.json](file:///c:/Users/shara/Downloads/orchids-aira-trading-app/railway.json#L1-L24).
- Root Railway config currently only declares `aira-brain`; that’s why you may only see it in Railway unless you manually created other services.
- Railway CLI is NOT logged in right now (status check failed). You’ll need `railway login` before I can create/link services via CLI.

## End-to-End Workflow Architecture

## 1) Strategy Lifecycle (Create → Optimize → Backtest → Save → Activate)
- **Create Draft Strategy**
  - User creates strategy intent/rules in web app → stored in `strategies` (draft fields + user_id).
- **Optimize (AiRA Brain + AI service)**
  - User runs “Improve” endpoint → calls [strategy-service.ts](file:///c:/Users/shara/Downloads/orchids-aira-trading-app/src/lib/server/strategy-service.ts) improvement loop and optionally RL request.
  - Output: updated `executable_strategy`, notes, and versioning/backtest records.
- **Backtest**
  - User runs backtest endpoint → uses candle-service + indicators → writes backtest results and trade logs.
- **Finalize/Save**
  - Strategy marked finalized, ready for activation.
- **Activation (Must map to trading engine)**
  - Today: activation route only flips `strategies.is_active`: [activate route](file:///c:/Users/shara/Downloads/orchids-aira-trading-app/src/app/api/strategies/%5BstrategyId%5D/activate/route.ts#L11-L59).
  - Trading engine actually reads `trading_preferences.strategy_id` to decide what to trade: [engine.ts](file:///c:/Users/shara/Downloads/orchids-aira-trading-app/railway/trading-engine/src/engine.ts).
  - **Planned fix:** when user activates a strategy “for trading”, also upsert `trading_preferences.strategy_id` (and optionally `strategy_type/timeframe`) so Railway trading-engine trades the correct strategy.

## 2) Admin API Keys + Auto-Login + Market Data Distribution
- **Admin Zerodha Configs (3 API keys)**
  - Stored in `admin_zerodha_configs` (api_key/access_token/etc).
- **Auto-login (Cron)**
  - Next cron endpoint refreshes admin tokens: `/api/cron/zerodha-auto-login`.
  - Alternatively Railway cron-maintenance can trigger refresh flows on schedule.
- **Market Data Worker (Canonical feed)**
  - `market-data-worker` maintains websocket connections using admin configs.
  - It writes:
    - Redis: live candle + candle history list + pubsub channels (fast low latency)
    - Supabase: `live_candles` upsert for persistence
  - Evidence of Redis distribution: [market-data-worker worker.ts](file:///c:/Users/shara/Downloads/orchids-aira-trading-app/railway/market-data-worker/src/worker.ts#L716-L756).
- **How pages/users consume data**
  - Web app reads from Supabase tables and/or realtime endpoints.
  - Trading engine reads candles primarily from Redis (fast), falls back to Supabase: [getLatestCandles](file:///c:/Users/shara/Downloads/orchids-aira-trading-app/railway/trading-engine/src/evaluator.ts#L174-L257).

## 3) AI Automated Trading Workflow (Paper + Live)

### 3.1 Common gates (paper + live)
- User must have `trading_preferences.auto_trading_enabled = true`: [toggle route](file:///c:/Users/shara/Downloads/orchids-aira-trading-app/src/app/api/trading/toggle/route.ts#L13-L68).
- Global kill switches must allow trading: `system_flags` via kill-switch manager.
- Per-user limits:
  - daily profit/loss quota
  - max trades/day
  - user segment preferences

### 3.2 Paper trading flow
- Trading engine places paper orders into `paper_orders` and manages `paper_positions`.
- It monitors positions and exits (SL/TP/trailing) automatically.

### 3.3 Live trading flow
- Trading engine loads user’s `user_broker_accounts` (decrypted tokens) and places real Kite orders.
- Before placing:
  - validate token not expired
  - validate segment permission
  - validate daily P/L + max trades/day
  - validate price-health/slippage
- After placing:
  - logs `user_orders`
  - monitors positions and triggers exits.

## 4) Railway Services (Create ALL, none optional)
**We will create these services in Railway and wire them together:**
1. **web-app** (Next.js) — the UI + APIs + cron endpoints (if you keep them)
2. **aira-brain** — worker logic (`npm run worker:logic`) for brain signals/analysis
3. **market-data-worker** — websocket ingestion + redis candle building + live_candles persistence
4. **trading-engine** — persistent evaluation loop and order execution (paper/live)
5. **cron-maintenance** — scheduled maintenance tasks (cleanup, roll, optional admin token refresh)
6. **rl-engine** — Python service for RL optimization
7. **Redis** (Railway plugin/service) — required for low-latency ticks/candles + pubsub

### Worker-to-worker connectivity
- `market-data-worker` → Redis + Supabase (writes candles)
- `trading-engine` → Redis + Supabase (reads candles; writes signals/orders/positions)
- `aira-brain` → Supabase (writes learnings/heartbeats/analysis)
- `web-app` → Supabase (UI + strategy CRUD); calls AI endpoints; triggers crons
- `rl-engine` ← (called by web-app optimizer) via `RL_ENGINE_URL` (internal railway URL)
- `cron-maintenance` → Supabase (and optionally calls internal services)

## 5) Railway CLI Execution Plan (After you confirm)

## 5.1 Railway login + project link
- Run `railway login` (required; CLI currently not authenticated).
- `railway link` to the correct project.

## 5.2 Create services (one per worker)
- Create Railway services for each directory:
  - `/` (web-app)
  - `/railway/trading-engine`
  - `/railway/market-data-worker`
  - `/railway/cron-maintenance`
  - `/railway/rl-engine`
  - `/` or `/` with worker command for `aira-brain` (or create a dedicated root worker service)
- For each service set:
  - Root directory
  - Build/start command (or use existing Dockerfiles in worker folders)
  - Watch paths (so changing one worker doesn’t redeploy all)

## 5.3 Set environment variables (per service)
- Shared:
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Redis:
  - `REDIS_URL` into services that use redis
- Trading:
  - any required broker/crypto env (none should be hardcoded)
- RL:
  - expose internal URL and set `RL_ENGINE_URL` on web-app

## 5.4 Deploy + generate domains
- Deploy each service.
- Generate domain for web-app (and any service that needs public access).
- Keep internal workers private.

## 6) Code/DB Changes Needed (Implementation after confirmation)
- **Strategy activation → trading engine selection:** update API so activating a strategy also writes `trading_preferences.strategy_id` and mode flags (scanner/trading).
- **Unify paper_trading_enabled settings:** ensure there is a stable API route to toggle paper mode and trading mode, and trading-engine reads it consistently.
- **Segments/risk preference wiring:** ensure `profiles.preferred_segments` or `trading_preferences.preferred_markets` is enforced in live order placement.
- **Remove duplicate execution paths:** make Railway trading-engine the single canonical executor; disable Next cron execute-signals by default (already gated in code).
- **Add operator health checks + mock test mode:** endpoint or script that simulates candles + signals and verifies paper positions open/close.

## 7) Mock Test / Verification Plan
- **Market data:** verify Redis keys update and `live_candles` rows increase.
- **Paper trading:** create a test strategy, enable paper+auto, confirm:
  - signals created
  - paper_orders created
  - paper_positions opened then closed by SL/TP/trailing
- **Live trading (sandbox-like):** validate “would place order” dry-run mode before enabling real orders.
- **Admin login automation:** verify admin tokens refresh and worker reconnects.

## Notes / Constraints
- Because CLI is not authenticated right now, the first step in execution will be Railway login; only after that can I create and link services.
- Railway monorepo setup requires setting Root Directory per service in Railway settings (or per-service config paths). See Railway monorepo docs: https://docs.railway.com/guides/monorepo

Confirm this plan and I will:
1) log in/link Railway via CLI, 2) create all missing services + Redis, 3) wire env vars, 4) deploy, 5) implement the code/DB wiring for the strategy→trading-engine workflow, and 6) run mock paper/live validations.