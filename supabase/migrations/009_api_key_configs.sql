CREATE TABLE IF NOT EXISTS api_key_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  tier_assignment TEXT NOT NULL CHECK (tier_assignment IN ('CORE', 'TEMP', 'FALLBACK')),
  zerodha_config_id UUID NOT NULL REFERENCES admin_zerodha_configs(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS api_key_configs_unique_active_core ON api_key_configs (tier_assignment)
  WHERE is_active = TRUE AND tier_assignment = 'CORE';

CREATE UNIQUE INDEX IF NOT EXISTS api_key_configs_unique_active_temp ON api_key_configs (tier_assignment)
  WHERE is_active = TRUE AND tier_assignment = 'TEMP';

CREATE UNIQUE INDEX IF NOT EXISTS api_key_configs_unique_active_fallback ON api_key_configs (tier_assignment)
  WHERE is_active = TRUE AND tier_assignment = 'FALLBACK';

CREATE INDEX IF NOT EXISTS api_key_configs_by_zerodha_config_id ON api_key_configs (zerodha_config_id);

ALTER TABLE api_key_configs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r record;
  i integer := 0;
BEGIN
  IF (SELECT COUNT(*) FROM api_key_configs) = 0 THEN
    FOR r IN
      SELECT id, name
      FROM admin_zerodha_configs
      WHERE is_active = TRUE
      ORDER BY created_at NULLS LAST, name
    LOOP
      i := i + 1;
      INSERT INTO api_key_configs (label, tier_assignment, zerodha_config_id)
      VALUES (
        r.name,
        CASE
          WHEN i = 1 THEN 'CORE'
          WHEN i = 2 THEN 'TEMP'
          ELSE 'FALLBACK'
        END,
        r.id
      );
    END LOOP;
  END IF;
END $$;

