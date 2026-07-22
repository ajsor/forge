-- Forge: track when a prospect actually opens a share link.
-- Run after 010_forge_shared_analyses.sql (shared project hrxrzpltwcndhpvfwkdm).
--
-- view_count already existed but had no timestamp, so the owner had no way
-- to know a prospect opened the report except by refreshing and comparing
-- counts by hand. first_viewed_at/last_viewed_at let the UI surface "viewed
-- 2h ago" and are the basis for a future "prospect went quiet after viewing"
-- follow-up nudge.

ALTER TABLE forge_share_links
  ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION forge_share_link_get(p_slug TEXT)
RETURNS TABLE (
  slug            TEXT,
  company_name    TEXT,
  brand_snapshot  JSONB,
  report_snapshot JSONB,
  view_count      INTEGER,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE forge_share_links s
     SET view_count = s.view_count + 1,
         first_viewed_at = COALESCE(s.first_viewed_at, NOW()),
         last_viewed_at = NOW()
   WHERE s.slug = p_slug
     AND s.is_active = TRUE
     AND (s.expires_at IS NULL OR s.expires_at > NOW());

  RETURN QUERY
    SELECT s.slug, s.company_name, s.brand_snapshot, s.report_snapshot,
           s.view_count, s.expires_at, s.created_at
      FROM forge_share_links s
     WHERE s.slug = p_slug
       AND s.is_active = TRUE
       AND (s.expires_at IS NULL OR s.expires_at > NOW());
END;
$$;

REVOKE ALL ON FUNCTION forge_share_link_get(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION forge_share_link_get(TEXT) TO anon, authenticated;
