-- Create user_orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    instrument_token BIGINT NOT NULL,
    tradingsymbol TEXT NOT NULL,
    exchange TEXT NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('BUY', 'SELL')),
    order_type TEXT NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT', 'SL', 'SL-M')),
    product TEXT NOT NULL CHECK (product IN ('CNC', 'NRML', 'MIS')),
    quantity INTEGER NOT NULL,
    price DECIMAL,
    trigger_price DECIMAL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    broker_order_id TEXT,
    tag TEXT,
    filled_quantity INTEGER DEFAULT 0,
    average_price DECIMAL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add order_timestamp column if it's missing (Fix for existing table)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_orders' AND column_name = 'order_timestamp') THEN
        ALTER TABLE user_orders ADD COLUMN order_timestamp TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_orders_user_id ON user_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_user_orders_status ON user_orders(status);
CREATE INDEX IF NOT EXISTS idx_user_orders_timestamp ON user_orders(order_timestamp);

-- Enable RLS
ALTER TABLE user_orders ENABLE ROW LEVEL SECURITY;

-- Policies (Drop first to avoid errors on retry)
DROP POLICY IF EXISTS "Users can view their own orders" ON user_orders;
CREATE POLICY "Users can view their own orders"
    ON user_orders FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own orders" ON user_orders;
CREATE POLICY "Users can insert their own orders"
    ON user_orders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own orders" ON user_orders;
CREATE POLICY "Users can update their own orders"
    ON user_orders FOR UPDATE
    USING (auth.uid() = user_id);
