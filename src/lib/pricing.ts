// Deterministic pricing + roadmap, mirroring the forge-analyze edge function.
// Used to recompute the SOW when the operator edits the optimization matrix
// (removes a line item, adjusts hours, or changes a tier). Same formula as
// generation: subtotal = dev_hours × hourly_rate × tier_multiplier, summed per
// tier, with the bundle discount applied to the grand total.

import type { OptimizationItem, Pricing, RateCard, RoadmapTier, Tier, EffortBucket } from '../types'

const TIER_LABELS: Record<Tier, string> = {
  1: 'Tier 1 — Quick Wins',
  2: 'Tier 2 — Mid-Term Transitions',
  3: 'Tier 3 — Long-Term Overhauls',
}
const TIER_WINDOWS: Record<Tier, string> = {
  1: '0–30 days',
  2: '30–90 days',
  3: '90+ days',
}

const round2 = (n: number) => Math.round(n * 100) / 100

// Effort bucket derived from hours, matching the edge function's buckets, so an
// edited item's effort label stays consistent with its hours.
export function effortForHours(hours: number): EffortBucket {
  if (hours <= 40) return 'Low'
  if (hours <= 120) return 'Medium'
  return 'High'
}

export function computePricing(matrix: OptimizationItem[], rate: RateCard): Pricing {
  const hr = Number(rate.hourly_rate) || 150
  const mults: Record<Tier, number> = {
    1: Number(rate.tier1_multiplier) || 1,
    2: Number(rate.tier2_multiplier) || 1,
    3: Number(rate.tier3_multiplier) || 1,
  }
  const line_items = matrix.map((m) => ({
    item_id: m.id,
    title: m.title,
    tier: m.tier,
    effort: m.effort,
    dev_hours: m.dev_hours,
    hourly_rate: hr,
    subtotal: round2(m.dev_hours * hr * mults[m.tier]),
  }))
  const tier_totals = ([1, 2, 3] as Tier[]).map((t) => ({
    tier: t,
    label: TIER_LABELS[t],
    subtotal: round2(line_items.filter((l) => l.tier === t).reduce((s, l) => s + l.subtotal, 0)),
  }))
  const subtotal = round2(line_items.reduce((s, l) => s + l.subtotal, 0))
  const bundle_discount_pct = Number(rate.bundle_discount_pct) || 0
  const bundle_discount_amount = round2(subtotal * (bundle_discount_pct / 100))
  const total = round2(subtotal - bundle_discount_amount)
  return {
    hourly_rate: hr,
    currency: rate.currency || 'USD',
    line_items,
    tier_totals,
    subtotal,
    bundle_discount_pct,
    bundle_discount_amount,
    total,
  }
}

export function buildRoadmap(matrix: OptimizationItem[]): RoadmapTier[] {
  return ([1, 2, 3] as Tier[]).map((t) => ({
    tier: t,
    label: TIER_LABELS[t],
    window: TIER_WINDOWS[t],
    item_ids: matrix.filter((m) => m.tier === t).map((m) => m.id),
  }))
}

// Reconstruct a RateCard-shaped object from an existing pricing snapshot when
// the user has no saved rate card. Tier multipliers can't be recovered from the
// snapshot, so they default to 1 (the generation default when unset).
export function rateCardFromPricing(p: Pricing): RateCard {
  return {
    id: '',
    user_id: '',
    hourly_rate: p.hourly_rate,
    currency: p.currency,
    bundle_discount_pct: p.bundle_discount_pct,
    tier1_multiplier: 1,
    tier2_multiplier: 1,
    tier3_multiplier: 1,
    updated_at: '',
  }
}
