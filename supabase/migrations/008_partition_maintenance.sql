-- Ensure partitioned tables have monthly partitions for current and future months

DO $$
DECLARE
  start_date date := date_trunc('month', now())::date;
  end_date date := (start_date + interval '24 months')::date;
  d date;
  live_partition_name text;
  ticks_partition_name text;
BEGIN
  EXECUTE 'CREATE TABLE IF NOT EXISTS live_candles_default PARTITION OF live_candles DEFAULT';
  EXECUTE 'CREATE TABLE IF NOT EXISTS realtime_ticks_default PARTITION OF realtime_ticks DEFAULT';

  d := start_date;
  WHILE d < end_date LOOP
    live_partition_name := format('live_candles_y%sm%s', to_char(d, 'YYYY'), to_char(d, 'MM'));
    ticks_partition_name := format('realtime_ticks_y%sm%s', to_char(d, 'YYYY'), to_char(d, 'MM'));

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF live_candles FOR VALUES FROM (%L) TO (%L)',
      live_partition_name,
      d::timestamp,
      (d + interval '1 month')::timestamp
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF realtime_ticks FOR VALUES FROM (%L) TO (%L)',
      ticks_partition_name,
      d::timestamp,
      (d + interval '1 month')::timestamp
    );

    d := (d + interval '1 month')::date;
  END LOOP;
END $$;

