DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'api_key_configs') THEN
    ALTER TABLE api_key_configs DROP CONSTRAINT IF EXISTS api_key_configs_tier_assignment_check;

    UPDATE api_key_configs
      SET tier_assignment = 'FALLBACK'
      WHERE tier_assignment = 'SCANNER';

    UPDATE api_key_configs
      SET tier_assignment = 'FALLBACK'
      WHERE tier_assignment NOT IN ('CORE', 'TEMP', 'FALLBACK');

    DROP INDEX IF EXISTS api_key_configs_unique_active_scanner;
    CREATE UNIQUE INDEX IF NOT EXISTS api_key_configs_unique_active_core ON api_key_configs (tier_assignment)
      WHERE is_active = TRUE AND tier_assignment = 'CORE';
    CREATE UNIQUE INDEX IF NOT EXISTS api_key_configs_unique_active_temp ON api_key_configs (tier_assignment)
      WHERE is_active = TRUE AND tier_assignment = 'TEMP';
    CREATE UNIQUE INDEX IF NOT EXISTS api_key_configs_unique_active_fallback ON api_key_configs (tier_assignment)
      WHERE is_active = TRUE AND tier_assignment = 'FALLBACK';

    IF NOT EXISTS (SELECT 1 FROM api_key_configs WHERE is_active = TRUE AND tier_assignment = 'TEMP') THEN
      UPDATE api_key_configs
        SET tier_assignment = 'TEMP'
        WHERE id = (
          SELECT id
          FROM api_key_configs
          WHERE is_active = TRUE AND tier_assignment <> 'CORE'
          ORDER BY created_at NULLS LAST
          LIMIT 1
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM api_key_configs WHERE is_active = TRUE AND tier_assignment = 'FALLBACK') THEN
      UPDATE api_key_configs
        SET tier_assignment = 'FALLBACK'
        WHERE id = (
          SELECT id
          FROM api_key_configs
          WHERE is_active = TRUE AND tier_assignment NOT IN ('CORE', 'TEMP')
          ORDER BY created_at NULLS LAST
          LIMIT 1
        );
    END IF;

    ALTER TABLE api_key_configs
      ADD CONSTRAINT api_key_configs_tier_assignment_check
      CHECK (tier_assignment IN ('CORE', 'TEMP', 'FALLBACK'));
  END IF;
END $$;
