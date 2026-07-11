-- Forge: close the public share-link enumeration hole.
-- Run after 004_forge_status_auditing.sql (shared project hrxrzpltwcndhpvfwkdm).
--
-- The original design granted anon SELECT on forge_share_links with a policy of
-- `is_active AND not expired`. Because RLS is row- not column-level and the
-- policy has no slug predicate, an anonymous client could `select *` with no
-- filter and download EVERY active link's report_snapshot + brand_snapshot
-- (client pricing, SOWs, white-label brand identities). The slug only gated the
-- UI, never the data.
--
-- Fix: remove anon table access entirely; the public viewer reads exactly one
-- row through a SECURITY DEFINER RPC keyed on the full slug, which also bumps
-- the view count atomically.

DROP POLICY IF EXISTS "forge_share_links_public_active_select" ON forge_share_links;
REVOKE SELECT ON forge_share_links FROM anon;

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
     SET view_count = s.view_count + 1
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

-- forge_share_link_view (migration 003) is now redundant for the viewer since
-- forge_share_link_get bumps the count itself, but it is left in place for
-- backward compatibility.
