## Current Audit (What’s true right now)
- Railway CLI is not authenticated on this machine, so it cannot verify/create services yet. First required step is `railway login`.
- Repo contains multiple Railway-ready services under [railway/](file:///c:/Users/shara/Downloads/orchids-aira-trading-app/railway):
  - [railway/trading-engine](file:///c:/Users/shara/Downloads/orchids-aira-trading-app/railway/trading-engine) (auto paper/live trading)
  - [railway/market-data-worker](file:///c:/Users/shara/Downloads/orchids-aira-trading-app/railway/market-data-worker) (Zerodha WS → Redis + Supabase candles)
  - [railway/cron-maintenance](file:///c:/Users/shara/Downloads/orchids-aira-trading-app/railway/cron-maintenance) (scheduled maintenance)
  - [railway/rl-engine](file:///c:/Users/shara/Downloads/orchids-aira-trading-app/railway/rl-engine) (python optimization)
  - “Aira brain” is currently the only service declared in root [railway.json](file:///c:/Users/shara/Downloads/orchids-aira-trading-app/railway.json).
- The automated trading engine depends on Redis candle feeds. Trading engine reads candles via Redis keys written by market-data-worker: [getLatestCandles](file:///c:/Users/shara/Downloads/orchids-aira-trading-app/railway/trading-engine/src/evaluator.ts#L170-L257) and candle publishing in [market-data worker](file:///c:/Users/shara/Downloads/orchids-aira-trading-app/railway/market-data-worker/src/worker.ts#L716-L736).
- Big functional gap vs your desired UX: “activating strategies in Strategy page” currently toggles `strategies.is_active` only and does not pick a strategy set for auto-trading; trading-engine expects `trading_preferences.strategy_id` (single) today. This needs a design decision (single active strategy vs multiple).

## Target Workflow (Matches your procedure)
- User creates strategies → backtest → optimize (Aira Brain) → save.
- User chooses which strategies are:
  - enabled for scanner/analysis
  - enabled for AI auto-trading (paper/live)
- Market Data Worker uses 3 admin Zerodha configs to stream ticks/candles → Redis + Supabase.
- Trading Engine:
  - reads user’s enabled auto-trade strategies
  - checks user broker connection (token)
  - checks funds/margins, allowed segments, risk caps, daily profit/loss
  - places paper or live orders
  - monitors open positions and exits according to strategy + Aira Brain assist

## Railway Deployment Structure (Correct “services” to exist)
- Service A: **aira-brain** (existing)
- Service B: **market-data-worker** (required for candles/Redis)
- Service C: **trading-engine** (required for paper/live order automation)
- Service D: **cron-maintenance** (optional but recommended)
- Service E: **rl-engine** (optional; used for strategy optimization)

## Railway CLI Verification + Creation (What I will do after you confirm)
1. Authenticate and link:
   - Run `railway login`
   - Link this repo to the correct Railway project (`railway link`) or create one if missing.
2. Inspect current Railway state:
   - List projects, services, environments, variables.
   - Confirm which services already exist (likely only aira-brain right now).
3. Create missing services:
   - Create services for trading-engine, market-data-worker, cron-maintenance, rl-engine.
   - Set each service root directory to `/railway/<service>` (monorepo setup).
4. Set required environment variables per service:
   - Common: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - market-data-worker + trading-engine: `REDIS_URL`
   - rl-engine: expose internal URL; set `RL_ENGINE_URL` on app/aira-brain side if needed.
   - Any admin Zerodha key/config variables required for market data ingest.
5. Generate internal networking expectations:
   - Confirm services can reach each other via Railway private networking (or rely purely on Supabase tables + Redis).

## Code/Schema Changes Needed (to match your product workflow)
1. **Strategy activation model** (decide one):
   - Option 1 (fast): only 1 auto-trade strategy per user (store `trading_preferences.strategy_id`). UI needs “Set as Auto-Trade Strategy”.
   - Option 2 (recommended): multiple strategies per user via join table (e.g. `user_active_strategies` with fields `user_id, strategy_id, purpose: scanner|trading`). Trading-engine loops through them.
2. **Balance/margin checks** before order placement:
   - For live: call Kite margins/funds endpoints using the user token; cap quantity or block.
   - For paper: maintain paper balance + update with PnL.
3. **Segment allowlist** enforcement:
   - Use `profiles.preferred_segments` or `user_risk_profiles.preferred_segments` as canonical.
   - Block order if exchange/segment not enabled.
4. **Daily profit/loss + max trades** canonical source:
   - Standardize on `user_risk_profiles` + `trading_preferences` for runtime state.
5. **Disable duplicate execution paths**:
   - Ensure live order execution happens only in Railway trading-engine, not in Next cron endpoints.

## Mock Tests / Verification Plan
- Local dry-run tests (paper mode):
  - Seed fake candle stream into Redis and validate trading-engine creates signals → paper_orders → paper_positions → exits.
- Live-mode “safety” tests (no real orders):
  - Run in “paper” but with real broker token to validate balance/segment checks.
- Production smoke tests:
  - Start market-data-worker → confirm Redis keys updating.
  - Start trading-engine → confirm it evaluates users, respects locks, respects kill switches.
  - Verify admin auto-login cron (if enabled) refreshes tokens correctly.

## Deliverables
- A Railway project with all required workers created, correctly configured, and connected.
- A clear “single source of truth” workflow for strategy selection (scanner vs trading).
- End-to-end verified: paper automated trading + live automated trading gating (funds/segments/risk/limits).

If you confirm this plan, I’ll start by logging in via Railway CLI, linking the project, listing what exists, then creating and wiring the missing services and moving into the code/schema updates + mock tests.