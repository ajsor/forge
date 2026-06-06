// Forge analyze pipeline.
//
// Stages, written to forge_analyses.status + .progress as they run:
//   pending → researching → auditing → analyzing → pricing → complete
//
// Pricing is computed DETERMINISTICALLY from the user's forge_rate_card
// (hourly_rate × dev_hours × tier_multiplier), not by the LLM.
// LLMs estimate dev hours per line item; the app multiplies.

import Anthropic from 'npm:@anthropic-ai/sdk@0.36.3'

const CORS = {
  'Access-Control-Allow-Origin': 'https://forge.stonecode.ai',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// In dev we also allow local origins. Prod CORS is enforced above.
function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    origin === 'http://localhost:5173' || origin === 'http://localhost:5174'
      ? origin
      : 'https://forge.stonecode.ai'
  return { ...CORS, 'Access-Control-Allow-Origin': allow }
}

/* ── System prompts ───────────────────────────────────────────────── */

const RESEARCH_SYSTEM = `You are Forge, an expert AI Business Analyst conducting deep research on a target SMB for a sales/consulting engagement.

Use web search aggressively. Search for:
- The company itself (website, About, team)
- Recent news, funding, leadership changes
- Hiring activity (LinkedIn/Indeed/their careers page) — reveals operational priorities
- Customer reviews, complaints, ratings (G2, Trustpilot, Google, Yelp depending on industry)
- Competitors and how the target compares
- Industry trends, regulatory pressures, AI-disruption vectors in their sector

You produce a STRICTLY REALISTIC, data-driven research dossier targeted at SMBs with LIMITED budgets and resources. No fluff, no consultant-speak. Every claim should be grounded in something you actually found. If a fact is unknown, say so — never fabricate funding numbers, headcount, customers, or dates.

Your FINAL message must be ONLY a single valid JSON object — no preamble, no markdown fencing, no commentary after.`

const AUDIT_SYSTEM = `You are Forge's Digital Presence Auditor — an expert at evaluating an SMB's public-facing digital footprint and identifying concrete, sellable fixes.

You audit FOUR areas and score each 0–100:

1. WEBSITE / UX — Visit their site. Evaluate: clarity of value proposition above the fold, navigation/IA, page speed signals (heavy images, third-party scripts), mobile responsiveness clues, trust signals (testimonials, case studies, certifications), CTAs and conversion paths, accessibility hints (alt text, color contrast cues), copy quality.

2. SEO — Read the homepage source for title/description meta tags, heading hierarchy, schema/structured data, internal linking. Search Google for their name + niche terms to see how visible they are. For local SMBs check Google Business Profile presence and NAP (name/address/phone) consistency. Estimate domain authority qualitatively from search rankings — do NOT invent numeric metrics like DA scores.

3. BRANDING — Logo quality and consistency, color palette, voice/tone consistency, tagline/positioning clarity, visual quality (professional vs amateur), consistency between site / social / reviews.

4. SOCIAL MEDIA — Search for their LinkedIn, X/Twitter, Instagram, Facebook, YouTube, TikTok (whichever are relevant to their sector). For each platform found, note URL, last post recency (active / dormant / absent), brand-consistency, content quality.

CRITICAL STANDARDS:
- Only state what you actually verified. Do NOT invent page speed milliseconds, DA scores, follower counts, or other numeric metrics you can't observe.
- Scoring rubric: 90+ = excellent, 70–89 = solid with minor gaps, 50–69 = significant issues, 30–49 = poor, <30 = severely deficient.
- Each "issue" must be a sellable observation — something an SMB owner would immediately recognize as a fix worth paying for.
- Each "strength" should be specific (not "good design"; instead "Clear value prop in hero with single CTA").
- Be calibrated for SMBs — don't penalize a 5-person plumbing company for not having a brand book.

Your FINAL message must be ONLY a single valid JSON object — no preamble, no markdown fencing, no commentary after.`

const ANALYZE_SYSTEM = `You are Forge, an expert AI Business Analyst, Solutions Architect, and SMB Operations Consultant.

You receive a RESEARCH DOSSIER about an SMB target and produce a comprehensive Business Optimization & Implementation Report tailored to an SMB with LIMITED budget and resources.

CORE STANDARDS:
- Be strictly realistic, data-driven, and SMB-appropriate. No enterprise-grade recommendations the company can't afford.
- Every Optimization Matrix item must address a SPECIFIC weakness or opportunity from the research/SWOT.
- Solutions should leverage modern automation, AI, lightweight SaaS, and APIs — not bespoke enterprise platforms.
- Be honest about effort and time. Don't undersell complexity.
- Dev hour estimates should reflect realistic implementation by a small team (1-2 engineers).

EFFORT BUCKETS (must match exactly):
- "Low"    = 0-40 dev hours,  0-30 day TTD,   Tier 1 (quick wins)
- "Medium" = 40-120 dev hours, 30-90 day TTD, Tier 2 (mid-term)
- "High"   = 120+ dev hours,  90+ day TTD,    Tier 3 (long-term overhauls)

ASSIGN TIER consistent with effort. Tier-1 items must be Low effort. Tier-3 items must be High effort.

Your FINAL message must be ONLY a single valid JSON object — no preamble, no markdown fencing, no commentary after.`

/* ── Types (matching forge frontend src/types.ts) ─────────────────── */

interface ResearchDossier {
  company_name: string
  snapshot: string
  value_proposition: string
  market_trends: string[]
  competitors: { name: string; positioning: string; url?: string }[]
  relative_positioning: string
  internal_signals: string[]
  external_signals: string[]
  ai_disruption_vectors: string[]
  customer_sentiment: string[]
  sources: { title: string; url: string }[]
}

interface OptimizationMatrixRaw {
  id?: string
  title: string
  problem: string
  solution: string
  technical_requirements: string[]
  effort: 'Low' | 'Medium' | 'High'
  dev_hours: number
  ttd_days: number
  roi_summary: string
  roi_quantitative?: string
  tier: 1 | 2 | 3
}

interface AnalysisJson {
  exec_summary: {
    company_overview: string
    value_proposition: string
    market_trends: string[]
    competitors: { name: string; positioning: string; url?: string }[]
    relative_positioning: string
  }
  swot: {
    strengths: { point: string; detail: string }[]
    weaknesses: { point: string; detail: string }[]
    opportunities: { point: string; detail: string }[]
    threats: { point: string; detail: string }[]
  }
  optimization_matrix: OptimizationMatrixRaw[]
}

interface AuditAreaRaw {
  score?: number
  strengths?: string[]
  issues?: string[]
  notes?: string
}

interface SocialPlatformRaw {
  name?: string
  url?: string
  status?: 'active' | 'dormant' | 'absent' | 'unknown'
  notes?: string
}

interface SocialAreaRaw {
  score?: number
  platforms?: SocialPlatformRaw[]
  issues?: string[]
  notes?: string
}

interface PriorityFixRaw {
  title?: string
  area?: 'website' | 'seo' | 'branding' | 'social'
  impact?: 'High' | 'Medium' | 'Low'
  effort?: 'Low' | 'Medium' | 'High'
}

interface DigitalAuditRaw {
  website?: AuditAreaRaw
  seo?: AuditAreaRaw
  branding?: AuditAreaRaw
  social?: SocialAreaRaw
  priority_fixes?: PriorityFixRaw[]
}

interface RateCardRow {
  hourly_rate: number
  currency: string
  bundle_discount_pct: number
  tier1_multiplier: number
  tier2_multiplier: number
  tier3_multiplier: number
}

/* ── Entry ────────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers)

  let stage = 'init'
  let analysisId: string | null = null
  let supabaseAdmin: ReturnType<typeof makeAdmin> | null = null

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401, headers)

    const { createClient } = await import('npm:@supabase/supabase-js@2')

    function makeAdmin() {
      return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    }
    supabaseAdmin = makeAdmin()
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    stage = 'auth'
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401, headers)

    const body = await req.json()
    analysisId = String(body.analysis_id ?? '')
    if (!analysisId || !/^[0-9a-f-]{36}$/i.test(analysisId)) {
      return json({ error: 'Invalid analysis_id' }, 400, headers)
    }

    stage = 'load_analysis'
    const { data: row } = await supabaseAdmin
      .from('forge_analyses')
      .select('id, user_id, target, context, recon_brief_id')
      .eq('id', analysisId)
      .maybeSingle()
    if (!row || row.user_id !== user.id) return json({ error: 'Forbidden' }, 403, headers)

    const target = String(row.target ?? '').slice(0, 200)
    const context = String(row.context ?? '').slice(0, 600)
    if (target.trim().length < 2) return json({ error: 'Target too short' }, 400, headers)

    // Reset for retry
    await supabaseAdmin.from('forge_analyses')
      .update({ status: 'researching', progress: 5, error: null })
      .eq('id', analysisId)

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    /* ── Stage 1: Research ──────────────────────────────────────── */
    stage = 'research'
    let dossier: ResearchDossier | null = null

    // If linked to a Recon brief, hydrate from it (cheap path).
    if (row.recon_brief_id) {
      const { data: brief } = await supabaseAdmin
        .from('recon_briefs')
        .select('company_name, brief, sources')
        .eq('id', row.recon_brief_id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (brief?.brief) {
        dossier = adaptReconBriefToDossier(brief.company_name, brief.brief, brief.sources)
      }
    }

    if (!dossier) {
      const researchPrompt =
        `Research this target and return a research dossier.\n\n` +
        `TARGET: ${target}\n` +
        (context ? `ENGAGEMENT CONTEXT: ${context}\n` : '') +
        `\nReturn ONLY this JSON object as your final message:\n` +
        `{\n` +
        `  "company_name": "resolved company name",\n` +
        `  "snapshot": "2-4 sentence factual overview (industry, size/stage, business model)",\n` +
        `  "value_proposition": "what they sell and to whom",\n` +
        `  "market_trends": ["force impacting their industry", "..."],\n` +
        `  "competitors": [{ "name": "...", "positioning": "...", "url": "https://..." }],\n` +
        `  "relative_positioning": "where target sits vs competitors",\n` +
        `  "internal_signals": ["operational/tech clues from their site, careers page, etc."],\n` +
        `  "external_signals": ["reviews, complaints, ratings, news"],\n` +
        `  "ai_disruption_vectors": ["ways AI/automation will impact their sector"],\n` +
        `  "customer_sentiment": ["common themes in reviews"],\n` +
        `  "sources": [{ "title": "...", "url": "https://..." }]\n` +
        `}`

      const research = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 5120,
        system: RESEARCH_SYSTEM,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 } as unknown as Anthropic.Tool],
        messages: [{ role: 'user', content: researchPrompt }],
      })

      const text = collectText(research)
      dossier = extractJson(text) as ResearchDossier | null
      if (!dossier) throw new Error('Could not parse research dossier')
    }

    await supabaseAdmin.from('forge_analyses')
      .update({
        status: 'auditing',
        progress: 30,
        company_name: clamp(dossier.company_name, 160) || target,
        sources: (dossier.sources ?? []).slice(0, 12).filter((s) => /^https?:\/\//i.test(s?.url ?? '')),
      })
      .eq('id', analysisId)

    /* ── Stage 2: Digital Presence Audit ───────────────────────── */
    stage = 'audit'

    const auditPrompt =
      `Audit this company's public digital presence. Use web search to actually visit their site and their social profiles.\n\n` +
      `COMPANY: ${dossier.company_name}\n` +
      `RESEARCH CONTEXT:\n${JSON.stringify({ snapshot: dossier.snapshot, value_proposition: dossier.value_proposition }, null, 2)}\n\n` +
      `Return ONLY this JSON object:\n` +
      `{\n` +
      `  "website": {\n` +
      `    "score": 72,\n` +
      `    "strengths": ["..."],\n` +
      `    "issues": ["specific, sellable fixes"],\n` +
      `    "notes": "what you actually evaluated"\n` +
      `  },\n` +
      `  "seo": { "score": 45, "strengths": ["..."], "issues": ["..."], "notes": "..." },\n` +
      `  "branding": { "score": 60, "strengths": ["..."], "issues": ["..."], "notes": "..." },\n` +
      `  "social": {\n` +
      `    "score": 35,\n` +
      `    "platforms": [\n` +
      `      { "name": "LinkedIn", "url": "https://www.linkedin.com/company/...", "status": "active", "notes": "Posts weekly, mostly product updates" },\n` +
      `      { "name": "X", "url": null, "status": "absent", "notes": "No verifiable account found" }\n` +
      `    ],\n` +
      `    "issues": ["..."],\n` +
      `    "notes": "..."\n` +
      `  },\n` +
      `  "priority_fixes": [\n` +
      `    { "title": "...", "area": "seo|website|branding|social", "impact": "High|Medium|Low", "effort": "Low|Medium|High" }\n` +
      `  ]\n` +
      `}\n\n` +
      `Produce 3-6 priority_fixes drawn from the most impactful issues across all four areas.`

    const auditMsg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 5120,
      system: AUDIT_SYSTEM,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 } as unknown as Anthropic.Tool],
      messages: [{ role: 'user', content: auditPrompt }],
    })

    const auditText = collectText(auditMsg)
    const auditRaw = (extractJson(auditText) ?? {}) as DigitalAuditRaw
    const digitalAudit = sanitizeAudit(auditRaw)

    await supabaseAdmin.from('forge_analyses')
      .update({ status: 'analyzing', progress: 55 })
      .eq('id', analysisId)

    /* ── Stage 3: Analyze (SWOT + Matrix, informed by audit) ──── */
    stage = 'analyze'

    const analyzePrompt =
      `Produce the full optimization report from this research dossier and digital presence audit.\n\n` +
      `RESEARCH DOSSIER:\n${JSON.stringify(dossier, null, 2)}\n\n` +
      `DIGITAL PRESENCE AUDIT:\n${JSON.stringify(digitalAudit, null, 2)}\n\n` +
      (context ? `ENGAGEMENT CONTEXT: ${context}\n\n` : '') +
      `Return ONLY this JSON object:\n` +
      `{\n` +
      `  "exec_summary": {\n` +
      `    "company_overview": "2-3 sentences",\n` +
      `    "value_proposition": "core value prop",\n` +
      `    "market_trends": ["..."],\n` +
      `    "competitors": [{ "name": "...", "positioning": "...", "url": "https://..." }],\n` +
      `    "relative_positioning": "..."\n` +
      `  },\n` +
      `  "swot": {\n` +
      `    "strengths":     [{ "point": "short label", "detail": "1-2 sentence explanation" }],\n` +
      `    "weaknesses":    [{ "point": "...", "detail": "..." }],\n` +
      `    "opportunities": [{ "point": "...", "detail": "..." }],\n` +
      `    "threats":       [{ "point": "...", "detail": "..." }]\n` +
      `  },\n` +
      `  "optimization_matrix": [\n` +
      `    {\n` +
      `      "title": "Concise solution title",\n` +
      `      "problem": "The underlying gap being addressed (anchored to a SWOT weakness/opportunity)",\n` +
      `      "solution": "Detailed description of the fix — automation, AI tooling, SaaS, etc.",\n` +
      `      "technical_requirements": ["software/API 1", "data structure 2", "..."],\n` +
      `      "effort": "Low|Medium|High",\n` +
      `      "dev_hours": 24,\n` +
      `      "ttd_days": 14,\n` +
      `      "roi_summary": "Qualitative ROI — what improves and how",\n` +
      `      "roi_quantitative": "Optional rough $/% impact",\n` +
      `      "tier": 1\n` +
      `    }\n` +
      `  ]\n` +
      `}\n\n` +
      `Produce 6-10 optimization matrix items, well-distributed across tiers (at least 2 in each tier when reasonable). Be honest about effort.\n\n` +
      `IMPORTANT: Translate the audit's priority_fixes into matrix items where appropriate. SMB-grade SEO/website/branding/social fixes are exactly the kind of quotable, fast-payback work that closes the engagement — represent them concretely.`

    const analyze = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: ANALYZE_SYSTEM,
      messages: [{ role: 'user', content: analyzePrompt }],
    })

    const analyzeText = collectText(analyze)
    const parsedAnalysis = extractJson(analyzeText) as AnalysisJson | null
    if (!parsedAnalysis) throw new Error('Could not parse analysis JSON')

    /* ── Stage 3: Pricing (deterministic) ───────────────────────── */
    stage = 'pricing'
    await supabaseAdmin.from('forge_analyses')
      .update({ status: 'pricing', progress: 85 })
      .eq('id', analysisId)

    const { data: rate } = await supabaseAdmin
      .from('forge_rate_card')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    const rateCard: RateCardRow = rate ?? {
      hourly_rate: 150,
      currency: 'USD',
      bundle_discount_pct: 12,
      tier1_multiplier: 1,
      tier2_multiplier: 1,
      tier3_multiplier: 1,
    }

    const sanitizedMatrix = sanitizeMatrix(parsedAnalysis.optimization_matrix)
    const pricing = computePricing(sanitizedMatrix, rateCard)
    const roadmap = buildRoadmap(sanitizedMatrix)

    const finalReport = {
      exec_summary: parsedAnalysis.exec_summary,
      swot: parsedAnalysis.swot,
      digital_audit: digitalAudit,
      optimization_matrix: sanitizedMatrix,
      roadmap,
      pricing,
    }

    stage = 'persist'
    await supabaseAdmin.from('forge_analyses')
      .update({
        status: 'complete',
        progress: 100,
        report: finalReport,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', analysisId)

    return json({ success: true }, 200, headers)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('forge-analyze error:', msg)
    if (supabaseAdmin && analysisId) {
      try {
        await supabaseAdmin.from('forge_analyses')
          .update({ status: 'error', error: msg.slice(0, 500), updated_at: new Date().toISOString() })
          .eq('id', analysisId)
      } catch (_) { /* swallow */ }
    }
    return json({ error: msg || 'Forge failed', stage }, 500, headers)
  }
})

/* ── Helpers ──────────────────────────────────────────────────────── */

function adaptReconBriefToDossier(
  companyName: string | null,
  brief: Record<string, unknown>,
  sources: unknown,
): ResearchDossier {
  const get = <T>(k: string, fallback: T): T => (brief?.[k] as T) ?? fallback
  const signals = get<Array<{ title?: string; detail?: string }>>('signals', [])
  return {
    company_name: companyName || String(get('company_name', '')) || '',
    snapshot: String(get('snapshot', '')),
    value_proposition: String(get('what_they_do', '')),
    market_trends: [],
    competitors: [],
    relative_positioning: '',
    internal_signals: signals.map((s) => [s.title, s.detail].filter(Boolean).join(' — ')).filter(Boolean),
    external_signals: [],
    ai_disruption_vectors: [],
    customer_sentiment: [],
    sources: Array.isArray(sources)
      ? (sources as Array<{ title?: string; url?: string }>)
          .map((s) => ({ title: String(s.title ?? ''), url: String(s.url ?? '') }))
          .filter((s) => /^https?:\/\//i.test(s.url))
      : [],
  }
}

function sanitizeAudit(raw: DigitalAuditRaw): {
  overall_score: number
  website: { score: number; strengths: string[]; issues: string[]; notes: string }
  seo: { score: number; strengths: string[]; issues: string[]; notes: string }
  branding: { score: number; strengths: string[]; issues: string[]; notes: string }
  social: { score: number; platforms: Array<{ name: string; url?: string; status: 'active' | 'dormant' | 'absent' | 'unknown'; notes: string }>; issues: string[]; notes: string }
  priority_fixes: Array<{ title: string; area: 'website' | 'seo' | 'branding' | 'social'; impact: 'High' | 'Medium' | 'Low'; effort: 'Low' | 'Medium' | 'High' }>
} {
  const cleanArea = (a: AuditAreaRaw | undefined) => ({
    score: clampScore(a?.score),
    strengths: strArray(a?.strengths, 8, 280),
    issues: strArray(a?.issues, 8, 280),
    notes: clamp(a?.notes, 600),
  })
  const website  = cleanArea(raw.website)
  const seo      = cleanArea(raw.seo)
  const branding = cleanArea(raw.branding)
  const platformsRaw = Array.isArray(raw.social?.platforms) ? raw.social!.platforms! : []
  const platforms = platformsRaw.slice(0, 8).map((p) => ({
    name: clamp(p?.name, 40) || 'Unknown',
    url: typeof p?.url === 'string' && /^https?:\/\//i.test(p.url) ? clamp(p.url, 300) : undefined,
    status: (p?.status === 'active' || p?.status === 'dormant' || p?.status === 'absent') ? p.status : 'unknown' as const,
    notes: clamp(p?.notes, 240),
  }))
  const social = {
    score: clampScore(raw.social?.score),
    platforms,
    issues: strArray(raw.social?.issues, 8, 280),
    notes: clamp(raw.social?.notes, 600),
  }

  const fixesRaw = Array.isArray(raw.priority_fixes) ? raw.priority_fixes : []
  const priority_fixes = fixesRaw.slice(0, 8).map((f) => ({
    title: clamp(f?.title, 200) || 'Fix',
    area: (['website', 'seo', 'branding', 'social'].includes(f?.area as string) ? f!.area : 'website') as 'website' | 'seo' | 'branding' | 'social',
    impact: (f?.impact === 'High' || f?.impact === 'Low' ? f.impact : 'Medium') as 'High' | 'Medium' | 'Low',
    effort: (f?.effort === 'Low' || f?.effort === 'High' ? f.effort : 'Medium') as 'Low' | 'Medium' | 'High',
  })).filter((f) => f.title && f.title !== 'Fix')

  const overall_score = Math.round((website.score + seo.score + branding.score + social.score) / 4)

  return { overall_score, website, seo, branding, social, priority_fixes }
}

function clampScore(n: unknown): number {
  const v = Number(n)
  if (!Number.isFinite(v)) return 50
  return Math.max(0, Math.min(100, Math.round(v)))
}

function sanitizeMatrix(raw: OptimizationMatrixRaw[] | undefined): NonNullable<OptimizationMatrixRaw[]> & { id: string }[] {
  const items = Array.isArray(raw) ? raw : []
  return items.slice(0, 12).map((it, idx): OptimizationMatrixRaw & { id: string } => {
    const effort: 'Low' | 'Medium' | 'High' =
      it.effort === 'Low' || it.effort === 'Medium' || it.effort === 'High' ? it.effort : 'Medium'
    const tierRaw = Number(it.tier)
    const tier: 1 | 2 | 3 =
      tierRaw === 1 ? 1 : tierRaw === 3 ? 3 : tierRaw === 2 ? 2 : effort === 'Low' ? 1 : effort === 'High' ? 3 : 2
    const devHours = Math.max(1, Math.min(800, Math.round(Number(it.dev_hours) || effortDefaultHours(effort))))
    const ttd = Math.max(1, Math.min(365, Math.round(Number(it.ttd_days) || tierDefaultDays(tier))))
    return {
      id: slug(`${idx + 1}-${it.title ?? 'item'}`),
      title: clamp(it.title, 160) || `Optimization ${idx + 1}`,
      problem: clamp(it.problem, 800),
      solution: clamp(it.solution, 1400),
      technical_requirements: strArray(it.technical_requirements, 10, 160),
      effort,
      dev_hours: devHours,
      ttd_days: ttd,
      roi_summary: clamp(it.roi_summary, 600),
      roi_quantitative: clamp(it.roi_quantitative, 240) || undefined,
      tier,
    }
  })
}

function effortDefaultHours(e: 'Low' | 'Medium' | 'High'): number {
  return e === 'Low' ? 24 : e === 'High' ? 180 : 80
}

function tierDefaultDays(t: 1 | 2 | 3): number {
  return t === 1 ? 21 : t === 3 ? 120 : 60
}

function computePricing(
  matrix: ReturnType<typeof sanitizeMatrix>,
  rate: RateCardRow,
): {
  hourly_rate: number; currency: string
  line_items: Array<{ item_id: string; title: string; tier: 1 | 2 | 3; effort: 'Low' | 'Medium' | 'High'; dev_hours: number; hourly_rate: number; subtotal: number }>
  tier_totals: Array<{ tier: 1 | 2 | 3; label: string; subtotal: number }>
  subtotal: number; bundle_discount_pct: number; bundle_discount_amount: number; total: number
} {
  const hr = Number(rate.hourly_rate) || 150
  const mults: Record<1 | 2 | 3, number> = {
    1: Number(rate.tier1_multiplier) || 1,
    2: Number(rate.tier2_multiplier) || 1,
    3: Number(rate.tier3_multiplier) || 1,
  }
  const line_items = matrix.map((m) => {
    const subtotal = round2(m.dev_hours * hr * mults[m.tier])
    return {
      item_id: m.id,
      title: m.title,
      tier: m.tier,
      effort: m.effort,
      dev_hours: m.dev_hours,
      hourly_rate: hr,
      subtotal,
    }
  })
  const tierTotals: Array<{ tier: 1 | 2 | 3; label: string; subtotal: number }> = ([1, 2, 3] as const).map(
    (t) => ({
      tier: t,
      label: tierLabel(t),
      subtotal: round2(line_items.filter((l) => l.tier === t).reduce((sum, l) => sum + l.subtotal, 0)),
    }),
  )
  const subtotal = round2(line_items.reduce((s, l) => s + l.subtotal, 0))
  const bundle_discount_pct = Number(rate.bundle_discount_pct) || 0
  const bundle_discount_amount = round2(subtotal * (bundle_discount_pct / 100))
  const total = round2(subtotal - bundle_discount_amount)
  return {
    hourly_rate: hr,
    currency: rate.currency || 'USD',
    line_items,
    tier_totals: tierTotals,
    subtotal,
    bundle_discount_pct,
    bundle_discount_amount,
    total,
  }
}

function buildRoadmap(matrix: ReturnType<typeof sanitizeMatrix>) {
  return ([1, 2, 3] as const).map((t) => ({
    tier: t,
    label: tierLabel(t),
    window: t === 1 ? '0–30 days' : t === 2 ? '30–90 days' : '90+ days',
    item_ids: matrix.filter((m) => m.tier === t).map((m) => m.id),
  }))
}

function tierLabel(t: 1 | 2 | 3): string {
  return t === 1 ? 'Tier 1 — Quick Wins' : t === 2 ? 'Tier 2 — Mid-Term Transitions' : 'Tier 3 — Long-Term Overhauls'
}

function collectText(message: Anthropic.Message): string {
  const parts: string[] = []
  for (const block of message.content) if (block.type === 'text') parts.push(block.text)
  return parts.join('\n').trim()
}

function extractJson(text: string): unknown {
  let t = text.trim()
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\n?/, '').replace(/\n?```\s*$/, '')
  try { return JSON.parse(t) } catch (_) { /* try harder */ }
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first >= 0 && last > first) {
    try { return JSON.parse(t.slice(first, last + 1)) } catch (_) { /* give up */ }
  }
  return null
}

function clamp(s: unknown, max: number): string {
  if (typeof s !== 'string') return ''
  const t = s.trim()
  return t.length > max ? t.slice(0, max) : t
}

function strArray(arr: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(arr)) return []
  return arr.slice(0, maxItems).map((s) => clamp(s, maxLen)).filter(Boolean)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'item'
}

function json(payload: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}
