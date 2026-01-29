import { RiskManagerWorker } from './risk-manager';
import { StrategistWorker } from './strategist';
import { PredictiveBrainWorker } from './predictive-brain';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function startBusinessWorkers() {
  console.log("🚀 Starting AiRA Business Logic Workers...");

  try {
    // 1. Risk Manager (Sentry)
    await RiskManagerWorker.getInstance().start();

    // 2. Strategist (Signal Generator)
    await StrategistWorker.getInstance().start();

    // 3. Predictive Brain (AI Engine)
    await PredictiveBrainWorker.getInstance().start();

    console.log("✅ All Business Workers are running.");
  } catch (error) {
    console.error("❌ Failed to start workers:", error);
    process.exit(1);
  }

  // Graceful Shutdown
  const shutdown = async () => {
    console.log("\n🛑 Shutting down workers...");
    await RiskManagerWorker.getInstance().stop();
    await StrategistWorker.getInstance().stop();
    await PredictiveBrainWorker.getInstance().stop();
    console.log("👋 Workers stopped. Bye!");
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startBusinessWorkers();
