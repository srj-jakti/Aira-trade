**Scope**

* Verify Railway CLI login and link to project

* Create ALL workers/services (none optional): web-app, aira-brain, market-data-worker, trading-engine, cron-maintenance, rl-engine, Redis

* Wire environment and internal connectivity, then implement workflow wiring across strategy creation/activation → market data → AI trading (paper/live)

**Architecture Workflow**

* Strategy Lifecycle

  * Create draft → optimize (AiRA Brain + RL) → backtest → finalize → activate

  * On activation: persist trading selection into trading\_preferences (strategy\_id, strategy\_type/timeframe, flags)

* Admin API Keys & Market Data

  * Maintain 3 Zerodha admin configs; auto-login via scheduled job

  * Market-data-worker ingests websockets and publishes to Redis and Supabase live\_candles

  * UI/engine consume Redis (fast) with Supabase fallback

* AI Trading (Paper & Live)

  * Gates: auto\_trading\_enabled, kill switches, per-user quotas & segments

  * Paper: paper\_orders + paper\_positions, auto exits (SL/TP/TSL)

  * Live: broker token check, segment & P/L checks, slippage health; logs user\_orders; position monitoring and exits

* Railway Services (all created)

  * web-app (Next.js)

  * aira-brain (worker: npm run worker:logic)

  * market-data-worker (Redis + Supabase)

  * trading-engine (persistent evaluation + execution)

  * cron-maintenance (maintenance schedules)

  * rl-engine (Python optimization service)

  * Redis service (plugin)

* Connectivity

  * market-data-worker → Redis/Supabase

  * trading-engine → Redis/Supabase

  * aira-brain → Supabase

  * web-app → Supabase + calls RL via internal URL

  * cron-maintenance → Supabase & workers

**Railway CLI Plan**

* Login: railway login, then railway link to project

* Create services and set Root Directory per service

* Configure build/start commands (use existing Dockerfiles for workers)

* Configure watch paths to avoid cross-redeploys (per monorepo docs)

* Set env vars: SUPABASE\_URL, SUPABASE\_SERVICE\_ROLE\_KEY, REDIS\_URL, RL\_ENGINE\_URL

* Deploy and generate domains for public services

**Implementation Changes**

* Activation route: also upsert trading\_preferences.strategy\_id (+ type/timeframe/flags)

* Ensure paper\_trading\_enabled and auto\_trading\_enabled toggles are read by trading-engine consistently

* Enforce segments and daily profit/loss limits in live order placement everywhere

* Keep Railway trading-engine canonical executor; cron execute-signals stays disabled unless explicitly enabled

* Add mock test endpoints/scripts to verify signals, orders, positions lifecycle

**Verification**

* Market data flowing

