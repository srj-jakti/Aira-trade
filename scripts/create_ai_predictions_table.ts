import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
  CREATE POLICY "Allow read access to all users" ON public.ai_predictions
    FOR SELECT USING (true);

  -- Create policy for service role to insert/update
  CREATE POLICY "Allow service role full access" ON public.ai_predictions
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
    
  -- Create index for faster queries
  CREATE INDEX IF NOT EXISTS idx_ai_predictions_token_time ON public.ai_predictions (instrument_token, prediction_time DESC);
`;

async function runMigration() {
  console.log('Running migration to create ai_predictions table...');
  
  // Note: Supabase JS client doesn't support running raw SQL directly for schema changes usually 
  // unless using the pg driver or specific rpc. 
  // However, we can try to use the rpc if a 'exec_sql' function exists, or just use the dashboard.
  // BUT, since we are an agent, the best way if CLI is not installed is to use a direct PG connection
  // OR provide the SQL to the user.
  // Let's try to use a postgres client library to execute this.
  
  console.log('SQL to Execute in Supabase SQL Editor:');
  console.log(createTableSQL);
}

runMigration();
