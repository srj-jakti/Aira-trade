## Project Summary
AiRA is an AI-powered market analysis and automation trading platform specialized for the Indian Markets (NSE/BSE). It integrates with brokers like Zerodha and uses AI to generate signals and manage trades.

## Tech Stack
- **Frontend/Backend:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Database/Auth:** Supabase (PostgreSQL, SSR)
- **Deployment:** Railway, Vercel
- **Key Libraries:** ioredis, kiteconnect, framer-motion, lucide-react

## Architecture
- **App Router:** `src/app` contains pages and API routes.
- **Middleware:** `src/middleware.ts` handles Supabase authentication and route protection.
- **Workers:** Background processes for market data and trading logic located in `src/workers` and `railway/`.
- **Database:** Supabase with Row Level Security (RLS) for data protection.

## User Preferences
- **Theme:** Default to Dark mode (using `dark` class on `html`).
- **Styling:** Tailwind CSS with custom UI components (Radix).
- **Code Style:** Functional components, named exports, minimal 'use client' usage.

## Project Guidelines
- **Security:** RLS must be enabled on all tables. Sensitive admin tables are restricted to `service_role`.
- **SEO:** Metadata is managed in `src/app/layout.tsx`. `robots.txt` and `sitemap.xml` are in `public/`.
- **Production:** `ignoreBuildErrors` and `ignoreDuringBuilds` must be `false` in `next.config.ts`.
- **API Protection:** Cron and admin routes must verify `CRON_SECRET` or `SUPABASE_SERVICE_ROLE_KEY`.

## Common Patterns
- **Database:** Use `supabaseAdmin` (service role) for system-level operations and `createServerClient` for user-level operations.
- **Safety:** Always use the `SQL` tool to explore schemas before making database changes.
