-- Forge: deal/outcome notes.
-- Run after 008_forge_pipeline_state.sql (shared project hrxrzpltwcndhpvfwkdm).
--
-- Free-text notes the owner adds after sending a report — call notes,
-- objections raised, negotiation status. Feeds the forge-followup drafter.
-- (Mirrors recon_briefs.notes from Recon's 2026-07-22 pass.)

ALTER TABLE forge_analyses
  ADD COLUMN IF NOT EXISTS notes TEXT;
