-- Shared per-user AI usage log for rate limiting across the satellite apps.
-- Idempotent: safe to run once on the shared project (hrxrzpltwcndhpvfwkdm)
-- even though every app ships a copy of this migration.
--
-- Only the service role (edge functions) reads/writes this table. RLS is
-- enabled with NO policies, so anon/authenticated have no access at all; the
-- service role bypasses RLS.

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL,
  app         TEXT NOT NULL,
  action      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_usage_events_lookup
  ON ai_usage_events (user_id, app, created_at DESC);

ALTER TABLE ai_usage_events ENABLE ROW LEVEL SECURITY;
