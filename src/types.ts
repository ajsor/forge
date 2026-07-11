/* ─── Pipeline stages ─────────────────────────────────────────────── */

export type AnalysisStatus =
  | 'pending'        // created, not yet started
  | 'researching'    // research stage running
  | 'auditing'       // digital presence audit (website / SEO / branding / social)
  | 'analyzing'      // SWOT + matrix + roadmap running
  | 'pricing'        // computing pricing from rate card
  | 'complete'
  | 'error'

/* ─── Digital Presence Audit ─────────────────────────────────────── */

export interface AuditArea {
  /** 0–100 score */
  score: number
  strengths: string[]
  issues: string[]
  /** 1–2 sentence summary of what was evaluated */
  notes: string
}

export type SocialStatus = 'active' | 'dormant' | 'absent' | 'unknown'

export interface SocialPlatform {
  name: string
  url?: string
  status: SocialStatus
  notes: string
}

export interface SocialArea {
  score: number
  platforms: SocialPlatform[]
  issues: string[]
  notes: string
}

export type PriorityImpact = 'High' | 'Medium' | 'Low'
export type AuditArea_Slug = 'website' | 'seo' | 'branding' | 'social'

export interface PriorityFix {
  title: string
  area: AuditArea_Slug
  impact: PriorityImpact
  effort: 'Low' | 'Medium' | 'High'
}

export interface DigitalAudit {
  /** Overall score derived from the four areas */
  overall_score: number
  website: AuditArea
  seo: AuditArea
  branding: AuditArea
  social: SocialArea
  /** Top 3–6 fixes pulled out of the area issues for executive scanning */
  priority_fixes: PriorityFix[]
}

export interface Competitor {
  name: string
  positioning: string
  url?: string
}

export interface SwotItem {
  point: string
  detail: string
}

export interface Swot {
  strengths: SwotItem[]
  weaknesses: SwotItem[]
  opportunities: SwotItem[]
  threats: SwotItem[]
}

export type EffortBucket = 'Low' | 'Medium' | 'High'
export type Tier = 1 | 2 | 3

export interface OptimizationItem {
  /** Stable slug for referencing in the roadmap/pricing */
  id: string
  title: string
  problem: string
  solution: string
  technical_requirements: string[]
  effort: EffortBucket
  /** Developer hours estimate (used by deterministic pricing) */
  dev_hours: number
  /** Time-to-deliver in days */
  ttd_days: number
  /** Qualitative ROI summary */
  roi_summary: string
  /** Optional quantitative ROI hint, free-form */
  roi_quantitative?: string
  /** Suggested tier (LLM hint; final tier is computed) */
  tier: Tier
}

export interface RoadmapTier {
  tier: Tier
  label: string
  window: string
  item_ids: string[]
}

export interface PriceLineItem {
  item_id: string
  title: string
  tier: Tier
  effort: EffortBucket
  dev_hours: number
  hourly_rate: number
  subtotal: number
}

export interface PricingTierTotal {
  tier: Tier
  label: string
  subtotal: number
}

export interface Pricing {
  hourly_rate: number
  currency: string
  line_items: PriceLineItem[]
  tier_totals: PricingTierTotal[]
  subtotal: number
  bundle_discount_pct: number
  bundle_discount_amount: number
  total: number
}

/* ─── The analysis row ────────────────────────────────────────────── */

export interface AnalysisReport {
  /** Section 1 — Executive Summary & Market Position */
  exec_summary: {
    company_overview: string
    value_proposition: string
    market_trends: string[]
    competitors: Competitor[]
    relative_positioning: string
  }
  /** Section 2 — SWOT */
  swot: Swot
  /** Section 3 — Digital Presence Audit (optional for legacy analyses) */
  digital_audit?: DigitalAudit
  /** Section 4 — Optimization Matrix */
  optimization_matrix: OptimizationItem[]
  /** Section 5 — Strategic Roadmap (computed from matrix items by tier) */
  roadmap: RoadmapTier[]
  /** Section 6 — Pricing & SOW (deterministically computed) */
  pricing: Pricing
}

export interface Source {
  title: string
  url: string
}

export interface Analysis {
  id: string
  user_id: string
  target: string
  context: string | null
  company_name: string | null
  /** Optional link to a Recon brief that seeded this analysis */
  recon_brief_id: string | null
  /** Selected brand for the report (null = default Forge styling) */
  brand_id: string | null
  status: AnalysisStatus
  /** The full report JSON, built up across stages */
  report: AnalysisReport | null
  sources: Source[] | null
  /** Progress within the active stage, 0-100 */
  progress: number
  error: string | null
  created_at: string
  updated_at: string
}

/* ─── White-label brand ───────────────────────────────────────────── */

export interface Brand {
  id: string
  user_id: string
  name: string
  /** Brand display name shown on the report cover (e.g. "Acme Consulting") */
  display_name: string
  tagline: string | null
  /** Primary/accent colors as hex */
  color_primary: string
  color_accent: string
  /** Font family CSS string */
  font_family: string
  /** Public logo URL (or data URL) */
  logo_url: string | null
  /** Contact block on report footer */
  contact_email: string | null
  contact_phone: string | null
  contact_website: string | null
  /** Legal entity for SOW */
  legal_entity: string | null
  legal_jurisdiction: string | null
  /** Cover letter template — supports {{company_name}} and {{contact_name}} */
  cover_letter_template: string | null
  /** Show 'Powered by stonecode.ai' attribution in footer */
  show_stonecode_attribution: boolean
  /** No-code Stripe Payment Link (or any checkout URL) for the deposit CTA */
  payment_url: string | null
  /** Optional deposit percentage, used to suggest a deposit amount on the CTA */
  deposit_pct: number | null
  is_default: boolean
  created_at: string
  updated_at: string
}

/* ─── Rate card ───────────────────────────────────────────────────── */

export interface RateCard {
  id: string
  user_id: string
  hourly_rate: number
  currency: string
  /** % discount applied when all tiers are bundled (0-100) */
  bundle_discount_pct: number
  /** Tier-1 quick-win multiplier on subtotal (1.0 = no change) */
  tier1_multiplier: number
  tier2_multiplier: number
  tier3_multiplier: number
  updated_at: string
}

/* ─── Share links ─────────────────────────────────────────────────── */

export interface ShareLink {
  id: string
  analysis_id: string
  user_id: string
  /** URL-safe slug used in /r/[slug] */
  slug: string
  /** Brand snapshot at the time the link was published (immutable) */
  brand_snapshot: Brand | null
  /** Report snapshot at publish time (immutable) */
  report_snapshot: AnalysisReport | null
  company_name: string | null
  is_active: boolean
  view_count: number
  expires_at: string | null
  created_at: string
}
