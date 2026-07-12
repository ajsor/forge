-- Forge: carry intermediate pipeline artifacts between per-stage invocations.
-- Run after 007_forge_brand_payment.sql.
--
-- forge-analyze was split into separate invocations (research → audit →
-- analyze → pricing) so each runs in its own edge worker with a fresh
-- wall-clock budget; the combined pipeline reliably exceeded Supabase's ~150s
-- request limit and got the worker killed mid-run. pipeline_state holds the
-- dossier / digital_audit / analysis JSON produced by earlier stages so the
-- next stage (a fresh invocation) can pick up where the last left off. It is
-- cleared (set NULL) when the analysis completes.

ALTER TABLE forge_analyses
  ADD COLUMN IF NOT EXISTS pipeline_state JSONB;
