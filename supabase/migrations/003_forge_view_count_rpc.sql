-- Forge: atomic view_count increment for the public share viewer.
-- Public can call this RPC to bump view_count without being able to UPDATE the row directly.

CREATE OR REPLACE FUNCTION forge_share_link_view(p_slug TEXT)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE forge_share_links
     SET view_count = view_count + 1
   WHERE slug = p_slug
     AND is_active = TRUE
     AND (expires_at IS NULL OR expires_at > NOW());
$$;

REVOKE ALL ON FUNCTION forge_share_link_view(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION forge_share_link_view(TEXT) TO anon, authenticated;
