import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { zerodhaService } from "../src/lib/server/zerodha-service"; // Adjust import if needed

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Hardcoded for now, but should ideally come from DB
const TARGET_INSTRUMENTS = [
  { token: 256265, symbol: "NIFTY 50", exchange: "NSE" },
  { token: 260105, symbol: "NIFTY BANK", exchange: "NSE" },
  { token: 256265, symbol: "SENSEX", exchange: "BSE" }, // Example token
  // Add more Nifty 50 stocks here
];

const TIMEFRAMES = [
  { tf: "minute", duration_days: 365, label: "1m (Scalping)" },
  { tf: "3minute", duration_days: 365, label: "3m (Scalping)" },
  { tf: "5minute", duration_days: 1095, label: "5m (Intraday)" }, // 3 years
  { tf: "15minute", duration_days: 1095, label: "15m (Intraday)" },
  { tf: "60minute", duration_days: 1825, label: "1h (Swing)" }, // 5 years
  { tf: "day", duration_days: 3650, label: "1d (Investment)" }, // 10 years
];

async function seedData() {
  console.log("Starting Market Data Seeding...");
  
  // Initialize Zerodha Service (Mock or Real)
  // Note: We assume zerodhaService can run in this script context
  // If not, we might need to use raw fetch with a known token
  // For this script, let's assume we fetch a valid token from DB manually first
  
  const { data: config } = await supabase
    .from("admin_zerodha_configs")
    .select("api_key, access_token")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!config) {
    console.error("No active Zerodha config found in DB");
    return;
  }

  const { api_key, access_token } = config;

  for (const inst of TARGET_INSTRUMENTS) {
    console.log(`\nProcessing ${inst.symbol} (${inst.token})...`);

    for (const tf of TIMEFRAMES) {
      console.log(`  > Timeframe: ${tf.label}`);
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - tf.duration_days);

      let currentFrom = new Date(startDate);
      let currentTo = new Date(startDate);
      
      // Zerodha limit ~2000 candles. 
      // Approx chunks: 1m = 2 days, 5m = 10 days, 60m = 100 days, day = 2000 days
      let chunkDays = 0;
      if (tf.tf === "minute") chunkDays = 2;
      else if (tf.tf === "3minute") chunkDays = 6;
      else if (tf.tf === "5minute") chunkDays = 10;
      else if (tf.tf === "15minute") chunkDays = 30;
      else if (tf.tf === "60minute") chunkDays = 100;
      else chunkDays = 2000;

      while (currentFrom < endDate) {
        currentTo.setDate(currentFrom.getDate() + chunkDays);
        if (currentTo > endDate) currentTo = endDate;

        const fromStr = currentFrom.toISOString().split("T")[0];
        const toStr = currentTo.toISOString().split("T")[0];

        try {
          const url = `https://api.kite.trade/instruments/historical/${inst.token}/${tf.tf}?from=${fromStr}&to=${toStr}`;
          const response = await fetch(url, {
            headers: {
              "X-Kite-Version": "3",
              "Authorization": `token ${decryptedApiKey}:${decryptedAccessToken}`
            }
          });

          const json = await response.json();
          if (json.status === "success" && json.data.candles.length > 0) {
            const rows = json.data.candles.map((c: any) => ({
              instrument_token: inst.token,
              timeframe: tf.tf, // Map correctly to DB enum if needed
              timestamp: c[0],
              open: c[1],
              high: c[2],
              low: c[3],
              close: c[4],
              volume: c[5]
            }));

            const { error } = await supabase.from("historical_candles").upsert(rows, { onConflict: "instrument_token,timeframe,timestamp" });
            
            if (error) console.error("    DB Error:", error.message);
            else console.log(`    Synced ${rows.length} candles (${fromStr} to ${toStr})`);
          } else {
            console.log(`    No data or error for ${fromStr} to ${toStr}`);
          }

        } catch (e) {
          console.error("    Fetch Error:", e);
        }

        // Rate limit pause
        await new Promise(r => setTimeout(r, 500)); 

        currentFrom = new Date(currentTo);
        // Avoid infinite loop if dates don't move
        if (currentFrom.getTime() === currentTo.getTime()) break; 
      }
    }
  }
}

seedData().catch(console.error);
