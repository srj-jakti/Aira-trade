# AiRA 2.0: Unified "Timeframe-Centric" Architecture Plan

## 1. The "Unified Timeframe" Strategy Logic
**Core Concept:** Timeframe determines Strategy Type. The AI will automatically classify all strategies into 4 distinct categories. This creates a "Universal Language" for the system.

### 1.1 Automatic Categorization Rules
When a strategy is created or saved, the system assigns a `category` tag automatically:
*   **Scalping:** Timeframe **1 min / 3 min**.
    *   *Focus:* Options Buying, High-momentum Equity.
    *   *AI Prediction Horizon:* Next 5-15 minutes.
*   **Intraday:** Timeframe **5 min / 15 min**.
    *   *Focus:* Options Buying/Selling, Equity Intraday.
    *   *AI Prediction Horizon:* Next 1 hour.
*   **Swing Trading:** Timeframe **1 Hour / 1 Day**.
    *   *Focus:* Equity Delivery, Futures, Options Selling (Positional).
    *   *AI Prediction Horizon:* Next 1-3 Days.
*   **Investment:** Timeframe **1 Day / 1 Week**.
    *   *Focus:* Equity Long-term.
    *   *AI Prediction Horizon:* Next 1-4 Weeks.

### 1.2 "Smart Context" User Settings
The AI filters available strategies based on User Preferences (Segment Selection):
*   **Scenario:** User selects "Segment: **Options Buying**" in Settings.
*   **AI Logic:** Automatically **IGNORES** Swing & Investment strategies (too risky/irrelevant). It **FOCUSES** only on Scalping & Intraday signals.
*   **Benefit:** The user doesn't need to manually filter; the AI "knows" what fits the asset class.

## 2. UI/UX Architecture "The 4 Pillars"

### 2.1 Public Strategy Page
*   **Layout:** Strategies are no longer a long list. They are organized into 4 big tabs: **Scalping | Intraday | Swing | Investment**.
*   **Visuals:** Each card shows the Timeframe, Asset Class, and "AI Confidence" specific to that category.

### 2.2 Analysis Page "Adaptive Prediction"
*   **Dynamic Visuals:** The chart and prediction adapt to the selected timeframe.
    *   *If User selects 1 min:* Analysis shows "Scalping Mode" -> Forecasts next 5 candles.
    *   *If User selects 1 Hour:* Analysis shows "Swing Mode" -> Forecasts next 2 days.

## 3. The "Railway Worker" Ecosystem (Updated)

### 3.1 The "Strategist" Worker (Classifier & Scanner)
*   **New Task:** "Strategy Classification".
*   **Logic:**
    1.  Read Strategy Timeframe.
    2.  Tag with Category (Scalping/Intraday/etc.).
    3.  **Smart Scan:** If scanning for an "Options" user, SKIP all Swing/Investment logic to save resources.

### 3.2 The "Predictive Brain" Worker (Context Aware)
*   **Context Awareness:** The AI adjusts its validation model based on the Category.
    *   *For Scalping:* Strict checks on **Momentum** (RSI/ADX). Ignored macro fundamentals.
    *   *For Investment:* Strict checks on **Fundamentals** & Macro Trends. Ignores 1-min noise.

## 4. Execution Roadmap (Step-by-Step)

1.  **Database Upgrade:** Add `category` and `asset_class_focus` columns to `strategies` table in Supabase.
2.  **Data Seeding:** Run the historical download script (covering all 4 timeframe groups).
3.  **ML Training:** Train 4 separate models (Scalper Model, DayTrader Model, Swing Model, Investor Model).
4.  **Worker Implementation:** Build the "Smart Scanner" that respects User Segment preferences.
5.  **UI Overhaul:** Redesign Strategy & Analysis pages to reflect the "4 Categories".
