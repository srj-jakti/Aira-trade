import { createClient } from "@supabase/supabase-js";

type BrainState = "IDLE" | "ACTIVE" | "PROCESSING" | "SHUTDOWN";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required");
if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");

const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

let state: BrainState = "ACTIVE";
let startTime = Date.now();
let requestsProcessed = 0;
let errorsCount = 0;

async function emitHeartbeat(): Promise<void> {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const payload = {
    state,
    uptime_seconds: uptimeSeconds,
    requests_processed: requestsProcessed,
    errors_count: errorsCount,
    volatility_level: "normal",
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("brain_heartbeats").insert(payload as any);
  if (error) {
    errorsCount++;
    console.error("[AiraBrainWorker] Heartbeat insert failed:", error.message);
  }
}

async function main(): Promise<void> {
  console.log("[AiraBrainWorker] Starting...");
  console.log("[AiraBrainWorker] Supabase URL:", supabaseUrl);

  await emitHeartbeat();

  const interval = setInterval(() => {
    emitHeartbeat().catch((e) => {
      errorsCount++;
      console.error("[AiraBrainWorker] Heartbeat error:", e instanceof Error ? e.message : String(e));
    });
  }, 30000);

  const shutdown = async (signal: string) => {
    console.log(`[AiraBrainWorker] Received ${signal}, shutting down...`);
    state = "SHUTDOWN";
    clearInterval(interval);
    await emitHeartbeat().catch(() => {});
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  await new Promise(() => {});
}

main().catch((e) => {
  console.error("[AiraBrainWorker] Fatal:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

