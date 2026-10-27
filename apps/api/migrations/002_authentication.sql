CREATE TABLE IF NOT EXISTS public.monitoring_users (
  id bigserial PRIMARY KEY,
  username varchar(64) NOT NULL,
  display_name varchar(120) NOT NULL,
  password_hash varchar(256) NOT NULL,
  role varchar(16) NOT NULL CHECK (role IN ('kadis', 'admin', 'petugas')),
  assigned_sources varchar(64)[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS monitoring_users_username_lower_uq
  ON public.monitoring_users (lower(username));

CREATE TABLE IF NOT EXISTS public.monitoring_sessions (
  token_hash char(64) PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES public.monitoring_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS monitoring_sessions_expiry_idx
  ON public.monitoring_sessions (expires_at);

CREATE TABLE IF NOT EXISTS public.monitoring_audit_log (
  id bigserial PRIMARY KEY,
  actor_user_id bigint REFERENCES public.monitoring_users(id) ON DELETE SET NULL,
  action varchar(64) NOT NULL,
  target_user_id bigint,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS monitoring_audit_log_created_idx
  ON public.monitoring_audit_log (created_at DESC);
