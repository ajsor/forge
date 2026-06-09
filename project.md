# Forge

> Hammer raw research into ready-to-sell SMB plans.

AI Business Analyst + Solutions Architect that turns an SMB target into a complete, white-labeled Business Optimization & Implementation Report — Executive Summary, SWOT, categorized Optimization Matrix, tiered Strategic Roadmap, and a transparently-priced Statement of Work. stonecode.ai delivers the engineering; a different marketing/sales partner fronts the engagement (white-label branded reports).

## Live Site

- **Production:** https://forge.stonecode.ai (after deploy — see Deploy below)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS 4 |
| Animations | Framer Motion |
| Routing | React Router v7 |
| Backend | Supabase (Auth, DB, Edge Functions) — shared project `hrxrzpltwcndhpvfwkdm` |
| AI | Anthropic Claude Sonnet 4.6 + `web_search_20250305` server tool |
| Hosting | Cloudflare Pages (project `forge`) |
| Auth handoff | `@stonecode/portal-sdk` (URL-hash session bootstrap) |
| CI/CD | GitHub Actions |

## What it does

A **Forge analysis** is a complete report on one SMB target. The user enters a company (or sends one in from Recon) and Forge runs a multi-stage agentic pipeline:

1. **Researching** — Web research dossier (or hydrated from a Recon brief)
2. **Analyzing** — Exec summary + SWOT + Optimization Matrix
3. **Pricing** — Deterministic computation from the user's rate card (LLM estimates hours, the app multiplies)

The output is a branded report viewable in-app, exportable as a PDF (browser print), and publishable as a public share link (`/r/{slug}`) the prospect can open without an account.

### Multi-brand white-labeling
A single Forge user can manage multiple **brands** — each brand has its own colors, logo, fonts, contact info, legal entity, cover letter template, and stonecode.ai attribution toggle. The brand chosen at analysis time determines how the report and share link look to the prospect. stonecode.ai stays invisible by default; the marketing/sales partner is the public face.

### Deterministic pricing
The LLM only estimates **dev hours per line item** — never dollar figures. Forge multiplies hours × hourly rate × tier multiplier from `forge_rate_card`, sums per tier, and applies the bundle discount. This keeps quotes consistent and defensible.

## Features

- [x] Multi-analysis, multi-user (RLS-scoped to Supabase user)
- [x] Multi-stage live pipeline with progress visualization (researching → analyzing → pricing)
- [x] Branded report renderer (cover, exec summary, SWOT, matrix, roadmap, priced SOW, sources)
- [x] White-label brand templates (CRUD)
- [x] Editable rate card with tier multipliers and bundle discount
- [x] Public share links with brand+report snapshots (immutable at publish-time)
- [x] PDF export via browser print stylesheet
- [x] Recon integration — "Send to Forge" button on Recon brief detail page
- [x] Portal feature flag `forge`
- [ ] Stripe checkout button on share links (future)
- [ ] Brand-owned custom subdomain for share links (future — currently shared domain only)
- [ ] Editable optimization matrix items (regenerate / tweak hours)

## Project Structure

```
forge/
├── .github/workflows/deploy.yml
├── public/{favicon.svg,_headers}
├── src/
│   ├── components/
│   │   ├── layout/AppLayout.tsx
│   │   ├── report/ReportView.tsx       — shared branded report renderer
│   │   └── ui/{Logo,LoadingScreen}.tsx
│   ├── contexts/AuthContext.tsx
│   ├── lib/{supabase,format}.ts
│   ├── pages/
│   │   ├── auth/AuthLandingPage.tsx
│   │   ├── app/{AnalysesPage,AnalysisDetailPage,BrandsPage,RateCardPage}.tsx
│   │   └── public/ReportViewPage.tsx   — anonymous /r/[slug] viewer
│   ├── router.tsx
│   ├── types.ts
│   ├── main.tsx
│   └── index.css
├── supabase/
│   ├── migrations/{001_forge_schema, 002_forge_rls, 003_forge_view_count_rpc}.sql
│   └── functions/forge-analyze/index.ts
└── project.md
```

## Database Schema

Shared Supabase project `hrxrzpltwcndhpvfwkdm`; all tables RLS-scoped to `auth.uid()`.

| Table | Purpose |
|-------|---------|
| `forge_brands` | White-label brand templates (logo, colors, contact, legal entity, cover letter). One default per user. |
| `forge_rate_card` | Per-user pricing inputs: hourly rate, currency, tier multipliers, bundle discount %. One row per user. |
| `forge_analyses` | One row per analysis — target, context, brand, status, full report JSONB, progress, sources. Soft-links to `recon_briefs(id)` via `recon_brief_id` when seeded from Recon. |
| `forge_share_links` | Public, anonymous-readable share links. Stores **immutable snapshots** of brand + report at publish time so subsequent edits don't change what the prospect sees. View count bumped via the `forge_share_link_view(slug)` SECURITY DEFINER RPC. |

## Edge Function

| Function | Purpose | Secrets used |
|----------|---------|--------------|
| `forge-analyze` | Runs the full pipeline: research (web search or recon hydration) → analyze (SWOT + Optimization Matrix via Claude) → deterministic pricing (rate card). Updates `forge_analyses.status` + `progress` so the UI can show a live progress bar. | `ANTHROPIC_API_KEY`, `SUPABASE_*` |

Verifies the caller's Supabase JWT, confirms analysis ownership, CORS-locked to `https://forge.stonecode.ai` in prod (+ localhost in dev). On failure it stamps `status='error'` so the UI can offer a retry.

## Portal integration

1. Feature flag `forge` — `stonecode.ai/supabase/migrations/022_forge_feature_flag.sql`
2. Portal sidebar — Forge added to `TOOLS` in `PortalLayout.tsx` (full URL, flag-gated)
3. `NoPortalAccessPage` — Forge added to the `APPS` list
4. Invitation pipeline — `forge` added to `AppSlug` + `APP_CONFIG` + `ALLOWED_ORIGINS` in `app-create-invitation`; `ALLOWED_ORIGINS` in `app-accept-invitation`

## Recon integration

- Recon's `BriefDetailPage` shows a **Send to Forge** CTA card on completed briefs that inserts a `forge_analyses` row with `recon_brief_id` set and redirects to `forge.stonecode.ai/app/analyses/<id>`. Forge's pipeline detects the `recon_brief_id` and hydrates its dossier from the brief, skipping web research.

## Development

```bash
cd C:\Users\ajs_o\Projects\forge
npm install
npm run dev
```

`.env.local`:
```
VITE_SUPABASE_URL=https://hrxrzpltwcndhpvfwkdm.supabase.co
VITE_SUPABASE_ANON_KEY=…   # from secrets.md
VITE_STONECODE_URL=https://stonecode.ai
```

## Deploy

GitHub Actions pushes `main` → Cloudflare Pages (`forge`).

### Required GitHub Secrets (`ajsor/forge`)
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `CLOUDFLARE_API_KEY`, `CLOUDFLARE_EMAIL`, `CLOUDFLARE_ACCOUNT_ID` — all from `secrets.md`.

### One-time manual steps
1. Create the GitHub repo `ajsor/forge` and push `main`.
2. Add the GitHub Secrets above.
3. Run migrations in Supabase SQL editor: `001_forge_schema.sql`, `002_forge_rls.sql`, `003_forge_view_count_rpc.sql`, then `stonecode.ai/.../022_forge_feature_flag.sql`.
4. Deploy edge function: `supabase functions deploy forge-analyze --project-ref hrxrzpltwcndhpvfwkdm`. `ANTHROPIC_API_KEY` is already set on the project.
5. Redeploy `app-create-invitation` + `app-accept-invitation` (`--no-verify-jwt`) so they pick up the `forge` slug + CORS origin.
6. DNS: CNAME `forge` → `<forge project>.pages.dev` in Cloudflare; attach `forge.stonecode.ai` as a custom domain to the Pages `forge` project.
7. Grant your user the `forge` flag (Admin → Users).
8. Push stonecode.ai so the new TOOLS entry + AppSlug reach production.

> **Note:** `forge-analyze` uses Claude's `web_search` server tool (~$0.01/search, capped at 8 per research run) plus a second Claude call for analysis. Billed to the shared `ANTHROPIC_API_KEY`. No new API key or subscription needed.

## Branding model

- **Forge** is the internal tool name the operator sees.
- **Brands** are the external faces — the marketing/sales partner the prospect interacts with.
- A brand's report by default shows NO stonecode.ai attribution. Toggle `show_stonecode_attribution = true` to add a small "Implementation powered by stonecode.ai" line to the footer of that brand's reports.
- The default Forge styling (used when no brand is selected) is the only place that displays "Generated by Forge · stonecode.ai".

## Pricing model

The rate card in `forge_rate_card` contains:
- `hourly_rate` — base hourly rate (e.g. $150)
- `currency`
- `bundle_discount_pct` — % discount applied when the prospect engages all tiers (0–50%)
- `tier1/2/3_multiplier` — per-tier price modifier (1.00 = no change)

For each optimization matrix item the LLM produces, Forge computes:
- `subtotal = hourly_rate × dev_hours × tier_multiplier`

Then sums per tier and applies the bundle discount to produce the SOW totals.

## Changelog

### 2026-06-08 — Edge function errors now log to shared `app_issues`
- `supabase/functions/_shared/appIssues.ts` (new); `forge-analyze` catch block now fires `logAppIssue({fn, stage, detail})` into stonecode.ai's shared `app_issues` table (migration 023). Failures surface in `/portal/admin/app-issues`.

### 2026-06-06 — Project initiated
- Vite + React 19 + TS scaffold, Tailwind 4, Framer Motion, React Router 7
- Schema (`forge_brands`, `forge_rate_card`, `forge_analyses`, `forge_share_links`) + RLS + `forge` feature flag
- Edge function `forge-analyze` — Claude Sonnet 4.6 with the `web_search` tool, three-stage pipeline
- Analyses list + detail (live pipeline progress, branded report viewer, share link + PDF export)
- Brands CRUD with logo/colors/legal entity/cover letter template
- Rate card editor with worked-example preview
- Public anonymous `/r/[slug]` viewer with brand+report snapshots
- Recon integration: "Send to Forge" on completed briefs
- Portal integration (TOOLS, NoPortalAccessPage, invitation edge functions, feature flag)
- GitHub Actions deploy workflow
