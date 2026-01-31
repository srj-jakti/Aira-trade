I will perform a comprehensive audit and cleanup to consolidate the backend workflow and remove dead code.

### 1. Lock File Cleanup
- **Issue:** The root directory contains both `package-lock.json` (npm) and `bun.lock` (Bun), creating conflicts.
- **Action:** Remove `bun.lock` from the root directory to standardize on **npm** for the Next.js application, matching the `package-lock.json`.

### 2. Remove Dead Code & Workflows
- **Target:** The `src/workers/` directory contains legacy/mock implementations (`strategist.ts`, `ticker-worker.ts`, `predictive-brain.ts`) that are superseded by the production-ready Railway services.
- **Action:** Delete the entire `src/workers/` directory.
- **Action:** Remove associated scripts from `package.json`:
  - `start:worker`
  - `worker:ticker`
  - `worker:logic`
  - `worker:ticker:prod`

### 3. Consolidate Backend Workflow
- **Strategy Creation:** Confirmed that `src/app/api/ai/generate-strategy` is the correct entry point and is decoupled from the dead workers.
- **Execution Engine:** Confirmed that `railway/trading-engine` is the single source of truth for live trading, risk management, and execution.
- **Outcome:** The system will have a clear, unidirectional flow:
  1.  **User** creates strategy via Next.js API (`/api/ai/generate-strategy`).
  2.  **Strategy** is saved to Supabase DB.
  3.  **Railway Trading Engine** picks up active strategies, executes trades, and manages risk.

### 4. Verification
- Verify that `package.json` is clean and valid.
- Ensure no references to `src/workers` remain in the critical path.
