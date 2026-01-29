import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

const createTableSQL = `
  CREATE TABLE IF NOT EXISTS public.ai_predictions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    instrument_token BIGINT NOT NULL,
    tradingsymbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    forecast_horizon TEXT,
    predicted_high NUMERIC,
    predicted_low NUMERIC,
    predicted_close NUMERIC,
    predicted_path JSONB,
    confidence_score NUMERIC,
    regime_detected TEXT,
    model_version TEXT,
    prediction_time TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Enable RLS
  ALTER TABLE public.ai_predictions ENABLE ROW LEVEL SECURITY;

  -- Create policy for reading (public or authenticated)
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'ai_predictions' AND policyname = 'Allow read access to all users'
    ) THEN
      CREATE POLICY "Allow read access to all users" ON public.ai_predictions FOR SELECT USING (true);
    END IF;
  END
  $$;

  -- Create policy for service role to insert/update
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'ai_predictions' AND policyname = 'Allow service role full access'
    ) THEN
      CREATE POLICY "Allow service role full access" ON public.ai_predictions FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
    END IF;
  END
  $$;
    
  -- Create index for faster queries
  CREATE INDEX IF NOT EXISTS idx_ai_predictions_token_time ON public.ai_predictions (instrument_token, prediction_time DESC);
`;

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to Database. Executing migration...');
    
    await client.query(createTableSQL);
    console.log('Migration completed successfully: ai_predictions table created.');
    
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigration();
