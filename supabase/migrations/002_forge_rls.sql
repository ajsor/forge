-- Forge: Row Level Security
-- Run after 001_forge_schema.sql.

ALTER TABLE forge_brands     ENABLE ROW LEVEL SECURITY;
ALTER TABLE forge_rate_card  ENABLE ROW LEVEL SECURITY;
ALTER TABLE forge_analyses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE forge_share_links ENABLE ROW LEVEL SECURITY;

/* ── forge_brands ────────────────────────────────────────────────── */
CREATE POLICY "forge_brands_select_own"
  ON forge_brands FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "forge_brands_insert_own"
  ON forge_brands FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "forge_brands_update_own"
  ON forge_brands FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "forge_brands_delete_own"
  ON forge_brands FOR DELETE USING (auth.uid() = user_id);

/* ── forge_rate_card ─────────────────────────────────────────────── */
CREATE POLICY "forge_rate_card_select_own"
  ON forge_rate_card FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "forge_rate_card_insert_own"
  ON forge_rate_card FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "forge_rate_card_update_own"
  ON forge_rate_card FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

/* ── forge_analyses ──────────────────────────────────────────────── */
CREATE POLICY "forge_analyses_select_own"
  ON forge_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "forge_analyses_insert_own"
  ON forge_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "forge_analyses_update_own"
  ON forge_analyses FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "forge_analyses_delete_own"
  ON forge_analyses FOR DELETE USING (auth.uid() = user_id);

/* ── forge_share_links ───────────────────────────────────────────── */
-- Owner can manage their share links.
CREATE POLICY "forge_share_links_select_own"
  ON forge_share_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "forge_share_links_insert_own"
  ON forge_share_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "forge_share_links_update_own"
  ON forge_share_links FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "forge_share_links_delete_own"
  ON forge_share_links FOR DELETE USING (auth.uid() = user_id);

-- Public read for active share links — the whole point is anonymous viewing.
-- Note: the snapshot fields are deliberately denormalized so we don't expose
-- a join into auth-scoped tables.
CREATE POLICY "forge_share_links_public_active_select"
  ON forge_share_links FOR SELECT
  USING (is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW()));

-- Required for Supabase Data API exposure on the shared project.
GRANT SELECT, INSERT, UPDATE, DELETE ON forge_brands     TO authenticated;
GRANT SELECT, INSERT, UPDATE          ON forge_rate_card  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON forge_analyses   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON forge_share_links TO authenticated;

-- Anon role can read active share links for the public viewer.
GRANT SELECT ON forge_share_links TO anon;
