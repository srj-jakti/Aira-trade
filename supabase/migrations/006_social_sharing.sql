-- Create shared_analysis table for public snapshots
CREATE TABLE IF NOT EXISTS shared_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    instrument_token BIGINT NOT NULL,
    tradingsymbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    analysis_data JSONB NOT NULL, -- Stores the AI analysis result (trend, signal, reasoning, etc.)
    chart_config JSONB, -- Stores indicators, overlay settings
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ -- Optional expiry for temporary links
);

-- Enable RLS
ALTER TABLE shared_analysis ENABLE ROW LEVEL SECURITY;

-- Allow public read access (anyone with the link/UUID can view)
CREATE POLICY "Public read access for shared analysis"
    ON shared_analysis FOR SELECT
    USING (true);

-- Allow authenticated users to create shares
CREATE POLICY "Users can create shared analysis"
    ON shared_analysis FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shared_analysis_id ON shared_analysis(id);
