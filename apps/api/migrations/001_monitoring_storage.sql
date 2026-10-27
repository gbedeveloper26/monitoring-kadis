CREATE TABLE IF NOT EXISTS public.monitoring_snapshots (
  source varchar(64) PRIMARY KEY,
  snapshot jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monitoring_snapshots_json_object CHECK (jsonb_typeof(snapshot) = 'object'),
  CONSTRAINT monitoring_snapshots_source_matches CHECK (snapshot->>'source' = source)
);

CREATE TABLE IF NOT EXISTS public.monitoring_webhook_events (
  source varchar(64) NOT NULL,
  event_id varchar(128) NOT NULL,
  received_at timestamptz NOT NULL,
  CONSTRAINT monitoring_webhook_events_pk PRIMARY KEY (source, event_id)
);

CREATE TABLE IF NOT EXISTS public.monitoring_snapshot_history (
  id bigserial PRIMARY KEY,
  source varchar(64) NOT NULL,
  metric varchar(128) NOT NULL,
  value bigint NOT NULL CHECK (value >= 0),
  as_of timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL,
  mode varchar(8) NOT NULL CHECK (mode IN ('REAL', 'DEMO'))
);

CREATE INDEX IF NOT EXISTS monitoring_webhook_events_received_idx
  ON public.monitoring_webhook_events (received_at DESC);

CREATE INDEX IF NOT EXISTS monitoring_snapshot_history_source_time_idx
  ON public.monitoring_snapshot_history (source, recorded_at DESC);
