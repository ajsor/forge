-- Forge: AI Business Optimization & Implementation Reports
-- Run in Supabase SQL editor (shared project hrxrzpltwcndhpvfwkdm).

/* ── Brands (white-label) ─────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS forge_brands (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                        TEXT NOT NULL,
  display_name                TEXT NOT NULL,
  tagline                     TEXT,
  color_primary               TEXT NOT NULL DEFAULT '#60a5fa',
  color_accent                TEXT NOT NULL DEFAULT '#f59e0b',
  font_family                 TEXT NOT NULL DEFAULT 'Inter, system-ui, sans-serif',
  logo_url                    TEXT,
  contact_email               TEXT,
  contact_phone               TEXT,
  contact_website             TEXT,
  legal_entity                TEXT,
  legal_jurisdiction          TEXT,
  cover_letter_template       TEXT,
  show_stonecode_attribution  BOOLEAN NOT NULL DEFAULT FALSE,
  is_default                  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS forge_brands_user_idx ON forge_brands(user_id, created_at DESC);

-- Only one default brand per user
CREATE UNIQUE INDEX IF NOT EXISTS forge_brands_one_default_per_user
  ON forge_brands(user_id) WHERE is_default = TRUE;

/* ── Rate card ────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS forge_rate_card (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  hourly_rate         NUMERIC(10,2) NOT NULL DEFAULT 150.00,
  currency            TEXT NOT NULL DEFAULT 'USD',
  bundle_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 12.00
    CHECK (bundle_discount_pct >= 0 AND bundle_discount_pct <= 50),
  tier1_multiplier    NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  tier2_multiplier    NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  tier3_multiplier    NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/* ── Analyses ─────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS forge_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target          TEXT NOT NULL,
  context         TEXT,
  company_name    TEXT,
  recon_brief_id  UUID, -- soft FK to recon_briefs(id); not enforced to avoid cross-app coupling
  brand_id        UUID REFERENCES forge_brands(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'researching', 'analyzing', 'pricing', 'complete', 'error')),
  report          JSONB,
  sources         JSONB,
  progress        SMALLINT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS forge_analyses_user_idx ON forge_analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS forge_analyses_recon_idx ON forge_analyses(recon_brief_id);

/* ── Share links ──────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS forge_share_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id     UUID NOT NULL REFERENCES forge_analyses(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL UNIQUE,
  -- Snapshot of brand + report at publish time so changes to brand/analysis
  -- don't retroactively alter what the prospect sees.
  brand_snapshot  JSONB,
  report_snapshot JSONB,
  company_name    TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  view_count      INTEGER NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS forge_share_links_slug_idx ON forge_share_links(slug);
CREATE INDEX IF NOT EXISTS forge_share_links_user_idx ON forge_share_links(user_id, created_at DESC);
