# Resuming AiRA 2.0 Implementation

I will proceed with the remaining tasks from the approved plan:

## 1. Backend Workers (The "Railway Workers")
*   **`workers/risk-manager.ts` (The Sentry):** Implement the logic to monitor user capital, enforce daily loss limits, and trigger kill switches.
*   **`workers/strategist.ts`:** Implement the service that continuously scans markets based on the 4 timeframe categories (Scalping, Intraday, Swing, Investment).

## 2. Frontend Upgrade: Strategy Page
*   **Update `src/app/(protected)/strategy/page.tsx`:**
    *   Add Tabs for the 4 Categories.
    *   Filter strategies automatically based on their timeframe.

## 3. Frontend Upgrade: Analysis Page
*   **Update `src/app/(protected)/analysis/page.tsx`:**
    *   Visualize the "Predictive Path" (future candles) from the AI engine.
    *   Display "Swing Structure" annotations.

I will now execute these changes.