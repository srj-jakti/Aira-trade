DO $$ 
BEGIN 
    -- 1. Add the column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'strategies' AND column_name = 'category') THEN
        ALTER TABLE strategies ADD COLUMN category text;
    END IF;

    -- 2. Drop the constraint if it exists (to update it)
    ALTER TABLE strategies DROP CONSTRAINT IF EXISTS strategies_category_check;

    -- 3. Add the updated constraint including 'OPTIONS'
    ALTER TABLE strategies ADD CONSTRAINT strategies_category_check 
    CHECK (category IN ('SCALPING', 'INTRADAY', 'SWING', 'INVESTMENT', 'OPTIONS'));
END $$;
