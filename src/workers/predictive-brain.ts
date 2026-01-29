import { spawn } from 'child_process';
import path from 'path';

export class PredictiveBrainWorker {
  private static instance: PredictiveBrainWorker;
  private isRunning = false;
  private interval = 900000; // 15 minutes (Run every 15m)

  private constructor() {}

  static getInstance(): PredictiveBrainWorker {
    if (!PredictiveBrainWorker.instance) {
      PredictiveBrainWorker.instance = new PredictiveBrainWorker();
    }
    return PredictiveBrainWorker.instance;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[PredictiveBrain] Worker Started");
    this.runLoop();
  }

  async stop() {
    this.isRunning = false;
    console.log("[PredictiveBrain] Worker Stopped");
  }

  private async runLoop() {
    // Initial run immediately
    try {
        await this.runPythonEngine();
    } catch (error) {
        console.error("[PredictiveBrain] Initial Run Error:", error);
    }

    while (this.isRunning) {
      await new Promise(r => setTimeout(r, this.interval));
      if (!this.isRunning) break;
      
      try {
        await this.runPythonEngine();
      } catch (error) {
        console.error("[PredictiveBrain] Error:", error);
      }
    }
  }

  private runPythonEngine(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log("[PredictiveBrain] Spawning Python Engine...");
      
      const scriptPath = path.join(process.cwd(), 'ml-engine', 'train_predictive_brain.py');
      
      // Use 'python' or 'python3' depending on env
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      
      const pythonProcess = spawn(pythonCmd, [scriptPath], {
        env: { ...process.env } // Pass env vars like SUPABASE_KEY
      });

      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) console.log(`[PredictiveBrain] ${output}`);
      });

      pythonProcess.stderr.on('data', (data) => {
        console.error(`[PredictiveBrain] Error: ${data.toString().trim()}`);
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          console.log("[PredictiveBrain] Engine finished successfully");
          resolve();
        } else {
          // Don't reject loop, just log
          console.error(`[PredictiveBrain] Python script exited with code ${code}`);
          resolve(); // Resolve anyway to keep worker alive
        }
      });
      
      pythonProcess.on('error', (err) => {
          console.error(`[PredictiveBrain] Failed to start python process: ${err.message}`);
          resolve();
      });
    });
  }
}

// Start worker if run directly
if (require.main === module) {
  PredictiveBrainWorker.getInstance().start();
}
