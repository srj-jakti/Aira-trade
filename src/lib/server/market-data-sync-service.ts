import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchAndStoreInstruments, fetchHistoricalData, storeHistoricalCandles } from "./market-data-engine";

export async function runDailyMarketDataSync() {
  console.log("Starting daily market data sync...");
  
  try {
    // 1. Check if global instrument sync is enabled
    const { data: status } = await supabaseAdmin
      .from("data_engine_status")
      .select("auto_sync_instruments")
      .eq("engine_type", "market_data")
      .single();

    if (status?.auto_sync_instruments) {
      console.log("Syncing instrument master list...");
      await fetchAndStoreInstruments();
      await supabaseAdmin.from("data_engine_status").update({
        last_instrument_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq("engine_type", "market_data");
    }

    // 2. Sync historical data for configured instruments
    const { data: configs } = await supabaseAdmin
      .from("instrument_sync_configs")
      .select("*")
      .eq("enabled", true);

    if (!configs || configs.length === 0) {
      console.log("No instruments configured for auto-sync.");
      return;
    }

    console.log(`Syncing historical data for ${configs.length} configurations...`);

    for (const config of configs) {
      try {
        // Find the latest candle timestamp for this instrument/timeframe
        const { data: lastCandle } = await supabaseAdmin
          .from("historical_candles")
          .select("timestamp")
          .eq("instrument_token", config.instrument_token)
          .eq("timeframe", config.timeframe)
          .order("timestamp", { ascending: false })
          .limit(1)
          .single();

        let fromDate: Date;
        if (lastCandle) {
          // Subtract 1 day to ensure we overwrite any partial candles from the last run
          fromDate = new Date(new Date(lastCandle.timestamp).getTime() - 24 * 60 * 60 * 1000);
        } else {
          // If no data exists, fetch based on default durations (shouldn't happen if config exists)
          fromDate = new Date();
          fromDate.setMonth(fromDate.getMonth() - 1);
        }

        const toDate = new Date();
        
        console.log(`Fetching ${config.timeframe} data for ${config.instrument_token} from ${fromDate.toISOString()}...`);
        const candles = await fetchHistoricalData(config.instrument_token, config.timeframe, fromDate, toDate);
        
        if (candles.length > 0) {
          const count = await storeHistoricalCandles(config.instrument_token, config.timeframe, candles);
          console.log(`Stored ${count} new/updated candles for ${config.instrument_token} (${config.timeframe})`);
        }

        // Update config status
        await supabaseAdmin.from("instrument_sync_configs").update({
          last_updated_at: new Date().toISOString()
        }).eq("id", config.id);

      } catch (err) {
        console.error(`Error syncing config ${config.id}:`, err);
      }
    }

    console.log("Daily market data sync completed.");
  } catch (error) {
    console.error("Critical error in daily sync:", error);
  }
}
