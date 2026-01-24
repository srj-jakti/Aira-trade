## Project Summary
AiRA Trading Platform is a high-performance trading application designed for secure hybrid architecture. It integrates with brokers like Zerodha and AI services to provide automated trading strategies, real-time market data, and advanced analysis tools. The project is currently undergoing a structural refactor to move sensitive logic and credential handling to a secure backend layer.

## Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS 4, Framer Motion, Lucide React, Recharts
- **Backend**: Next.js API Routes, Node.js, Bun
- **Database/Auth**: Supabase (PostgreSQL, Auth, RLS)
- **Caching/Realtime**: Redis (ioredis), Supabase Realtime
- **Trading/Finance**: KiteConnect (Zerodha), Lightweight Charts
- **Validation/Security**: Zod, Crypto (AES-256-GCM)
- **Infrastructure**: Railway (rl-engine, trading-engine, market-data-worker)

## Architecture
- **Hybrid Security Model**: Supabase handles data persistence with RLS, while Vercel/Next.js handles authority, encryption, and complex business logic.
- **Service Breakdown**:
  - `src/app`: Next.js frontend and API routes.
  - `railway/`: Microservices for market data, trading execution, and AI processing.
  - `src/lib/server`: Secure server-only utilities for auth, encryption, and audit.

## User Preferences
- Use functional components.
- Prefer named exports over default exports.
- Follow App Router conventions.
- No comments unless requested.

## Project Guidelines
- Sensitive data (Level 3-4) must never touch the client.
- All API routes must use Zod for validation.
- Every sensitive action must be logged to the audit trail.
- Follow the ARCHITECTURE_REFACTOR_GUIDE.md for current implementation steps.

## Common Patterns
- **API Responses**: Standardized via `src/lib/server/auth.ts` helpers.
- **Supabase Access**: Use `supabaseAdmin` (service role) for backend-only operations, and standard client for user-owned data.
