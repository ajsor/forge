-- Forge: opt-in team sharing.
-- Run after 009_forge_deal_notes.sql (shared project hrxrzpltwcndhpvfwkdm).
--
-- Same pattern as Recon's 006_recon_shared_briefs.sql: the SELECT policy is
-- scoped to users who hold the `forge` feature flag (via
-- user_feature_flags -> feature_flags), NOT every authenticated user on the
-- shared project. auth.users is shared across every satellite app, so an
-- unscoped `shared = true` policy would leak client SOWs/pricing to users of
-- unrelated apps who never had Forge access. INSERT/UPDATE/DELETE stay
-- owner-only (existing policies from 002_forge_rls.sql are unaffected).

ALTER TABLE forge_analyses
  ADD COLUMN IF NOT EXISTS shared BOOLEAN NOT NULL DEFAULT false;

CREATE POLICY "forge_analyses_select_shared"
  ON forge_analyses FOR SELECT
  TO authenticated
  USING (
    shared = true
    AND EXISTS (
      SELECT 1 FROM user_feature_flags uff
      JOIN feature_flags ff ON ff.id = uff.feature_id
      WHERE uff.user_id = auth.uid() AND ff.name = 'forge'
    )
  );
