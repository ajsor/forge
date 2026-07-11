-- Forge: per-brand payment / deposit configuration for the "Pay deposit" CTA
-- on share links. Run after 006_ai_rate_limit.sql.
--
-- payment_url is a no-code Stripe Payment Link (or any checkout URL) the brand
-- owner creates in their own Stripe dashboard — no API keys live in Forge.
-- deposit_pct optionally drives a suggested deposit amount shown on the button.

ALTER TABLE forge_brands
  ADD COLUMN IF NOT EXISTS payment_url TEXT,
  ADD COLUMN IF NOT EXISTS deposit_pct NUMERIC(5,2)
    CHECK (deposit_pct IS NULL OR (deposit_pct >= 0 AND deposit_pct <= 100));
