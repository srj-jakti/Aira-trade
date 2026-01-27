# Production Audit Report - AiRA Trading Platform
**Date:** 2026-01-27
**Environment:** Railway (Workers), Vercel (Frontend)

## Executive Summary
The project is in a **high state of readiness** for production. The architecture correctly separates concerns between the serverless Next.js app and persistent Railway workers.

**Critical Actions Required:**
1.  **Add Redis Service:** Redis is required for the `trading-engine` and `market-data-worker` but is not automatically provisioned.
2.  **Environment Variables:** `ENCRYPTION_KEY` and `REDIS_URL` must be set in Railway.

---

## 1. Service Configuration (Railway)

### Workers & Database
The project defines four workers in `railway.json`:
-   `trading-engine`: Handles order execution and strategy logic. **(Fixed build path)**
-   `market-data-worker`: Processes live ticks and builds candles.
-   `cron-maintenance`: Runs scheduled tasks.
-   `rl-engine`: Python-based Reinforcement Learning service. **(Added to config)**

**Missing Service:** **Redis**
The workers explicitly depend on Redis (verified in `railway/trading-engine/src/utils/redis.ts`), but it is not defined as a service in `railway.json`.

**Action Plan:**
1.  Run `railway add` and select **Redis**.
2.  This will automatically expose `REDIS_URL` to all services in the project.
3.  Ensure `REDIS_URL` is *not* exposed to the Next.js frontend during build unless explicitly needed (the code handles this safely).

### Environment Variables Checklist
Ensure these are set in the Railway Project Dashboard (Shared Variables):

| Variable | Requirement | Status |
| :--- | :--- | :--- |
| `REDIS_URL` | Auto-set by Railway Redis plugin | ⚠️ **Action Required** |
| `ENCRYPTION_KEY` | **Must be 32 bytes (64 hex chars)** | 🔴 **Critical** |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for admin/cron tasks | 🔴 **Critical** |
| `NEXT_PUBLIC_SUPABASE_URL` | Required for all services | 🔴 **Critical** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required for all services | 🔴 **Critical** |
| `RAZORPAY_KEY_ID` | Required for payments | ⚠️ **Check** |
| `RAZORPAY_KEY_SECRET` | Required for payments | ⚠️ **Check** |

---

## 2. Code Quality & Security Audit

### Linting Results
-   **Errors:** 0
-   **Warnings:** 189 (mostly `no-unused-vars` and `react-hooks/exhaustive-deps`)
-   **Assessment:** The code is safe to build. The warnings are non-blocking but indicate opportunities for cleanup.
-   **Key Fix:** A Suspense boundary issue in `src/app/pricing/page.tsx` was fixed, preventing build failures.

### Security
-   **Encryption:** Uses `aes-256-gcm` (Standard).
-   **Headers:** `next.config.ts` implements strict security headers (`HSTS`, `X-Frame-Options`).
-   **Middleware:** `src/middleware.ts` robustly protects admin and user routes based on subscription plans.
-   **Rate Limiting:** ⚠️ **Missing.** The `middleware.ts` does not currently implement rate limiting.
    *   **Risk:** Potential for API abuse.
    *   **Recommendation:** Implement `upstash/ratelimit` or a custom Redis-based limiter in middleware.

### Performance
-   **Worker Architecture:**
    *   `market-data-worker`: Buffers ticks (5s interval).
    *   `trading-engine`: Uses distributed locking (Redis) for order execution safety.
    *   `cron-maintenance`: Self-contained maintenance tasks.
    *   `rl-engine`: Isolated Python environment for heavy ML compute.

---

## 3. Deployment Instructions

1.  **Link Project:**
    ```bash
    railway link
    ```
2.  **Add Redis:**
    -   Go to Railway Dashboard or run `railway add` -> Redis.
3.  **Set Variables:**
    -   Add the variables listed in Section 1.
4.  **Deploy:**
    ```bash
    railway up
    ```

## 4. Recommendations for Improvement
1.  **Implement Rate Limiting:** Add a Redis-based rate limiter in `middleware.ts` to protect public API routes.
2.  **Error Monitoring:** Integrate Sentry or Axiom to capture worker errors (currently only logged to console).
3.  **Clean Up Unused Vars:** Run `eslint --fix` to reduce noise in the codebase.
