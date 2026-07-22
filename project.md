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
- [x] Recon integration — "Send to Forge" button on Recon brief detail page; Recon-brief picker on the New Analysis form
- [x] Portal feature flag `forge`
- [x] Editable optimization matrix items (regenerate / tweak hours)
- [x] Recon hydration carries known pain points, objections, and post-meeting notes into the dossier (not just snapshot/signals)
- [x] Deal notes + AI-drafted follow-up email
- [x] Account grouping and opt-in team sharing on the Analyses list
- [x] Share-link view timestamps (first/last viewed) surfaced on the analysis and list
- [ ] Stripe checkout button + webhook-driven deposit-paid status (future — needs Stripe account wiring)
- [ ] Brand-owned custom subdomain for share links (future — currently shared domain only)

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
│   ├── migrations/001-011 (schema, RLS, view count, status/auditing, share-link get, rate limit, brand payment, pipeline state, deal notes, shared, view tracking)
│   └── functions/{forge-analyze,forge-followup}/index.ts
└── project.md
```

## Database Schema

Shared Supabase project `hrxrzpltwcndhpvfwkdm`; all tables RLS-scoped to `auth.uid()`.

| Table | Purpose |
|-------|---------|
| `forge_brands` | White-label brand templates (logo, colors, contact, legal entity, cover letter). One default per user. |
| `forge_rate_card` | Per-user pricing inputs: hourly rate, currency, tier multipliers, bundle discount %. One row per user. |
| `forge_analyses` | One row per analysis — target, context, brand, status, full report JSONB, progress, sources, notes (deal outcome), shared. Soft-links to `recon_briefs(id)` via `recon_brief_id` when seeded from Recon. |
| `forge_share_links` | Public, anonymous-readable share links. Stores **immutable snapshots** of brand + report at publish time so subsequent edits don't change what the prospect sees. `view_count`/`first_viewed_at`/`last_viewed_at` bumped via the `forge_share_link_get(slug)` SECURITY DEFINER RPC. |

`shared` defaults `false`; a permissive SELECT policy (migration 010) exposes `shared = true` analyses to other users, but only those holding the `forge` feature flag (checked via `user_feature_flags`/`feature_flags`) — not every authenticated user on the shared project. INSERT/UPDATE/DELETE stay owner-only; a non-owner viewing a shared analysis sees a read-only report (no edit/publish/retry controls, no auto-run of the pipeline).

## Edge Function

| Function | Purpose | Secrets used |
|----------|---------|--------------|
| `forge-analyze` | Runs the full pipeline: research (web search or Recon hydration) → audit → analyze (SWOT + Optimization Matrix via Claude) → deterministic pricing (rate card). When hydrating from a Recon brief, also carries over `likely_pains`, `objection_prep`, and post-meeting `notes` as `known_pain_points`/`known_objections`/`known_context` — treated as verified ground truth, not inference. Updates `forge_analyses.status` + `progress` so the UI can show a live progress bar. | `ANTHROPIC_API_KEY`, `SUPABASE_*` |
| `forge-followup` | Drafts a follow-up email from an analysis's deal notes + share-link view status (no web search, not persisted — returned directly to the client) | `ANTHROPIC_API_KEY`, `SUPABASE_*` |

Both verify the caller's Supabase JWT, confirm analysis ownership, CORS-lock to `https://forge.stonecode.ai` (+ localhost in dev), and are rate-limited via the shared `ai_usage_events` table. `forge-analyze` failure stamps `status='error'` so the UI can offer a retry.

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

### 2026-07-22 — Recon parity: dossier fix, deal notes, sharing, view tracking
- **Fixed a real gap in Recon hydration:** `adaptReconBriefToDossier` previously discarded a linked Recon brief's `likely_pains` and `objection_prep`, and had no way to see the brief's post-meeting `notes` (added to Recon the same day). Now all three flow into the dossier as `known_pain_points`/`known_objections`/`known_context`, and the analyze-stage system prompt instructs Claude to treat them as verified ground truth (not inference) when building the SWOT and optimization matrix.
- **Recon-brief picker:** the New Analysis form's "Seed from Recon brief" field was a raw UUID paste box — replaced with a dropdown of the user's own completed Recon briefs by company name.
- **Deal notes + follow-up drafter:** free-text notes field on an analysis (owner-only edit) for call outcomes/objections/negotiation status; new `forge-followup` edge function drafts a short follow-up email from those notes plus the report and share-link view status. Shown in a modal with copy-to-clipboard, not persisted.
- **Team sharing:** owner-only "Share with team" toggle (`shared` column, **migration 010**) plus a Mine/Team tab on the Analyses list. RLS scopes visibility to users who hold the `forge` feature flag, not every authenticated user on the shared Supabase project. A non-owner viewing a shared analysis gets a read-only report — no edit/publish/retry controls, and the pipeline auto-run is gated to the owner so a viewer can't trigger billed AI work on someone else's analysis.
- **Account grouping:** "Group by account" toggle on the Analyses list, same as Recon.
- **Share-link view tracking:** `first_viewed_at`/`last_viewed_at` columns (**migration 011**) on `forge_share_links`, set by `forge_share_link_get`. The analysis detail page shows "last viewed …"; the Analyses list shows a "Viewed Xh ago" badge per analysis.
- Deliberately not done — flagged as needing Stripe wiring: a webhook-driven deposit-paid status separate from the AI pipeline's `status` field.
- Requires migrations 009+010+011 and redeploy of `forge-analyze` (both applied/deployed) + new `forge-followup` deploy (done).

### 2026-07-12 — Fix: pipeline reliably completes (per-stage state machine)
- **Root cause:** the old `forge-analyze` ran research + two web-search calls + analysis in ONE invocation, which blew past Supabase's ~150s edge worker wall-clock limit and got killed mid-run (repro: died at `auditing`, later `analyzing`). `EdgeRuntime.waitUntil` background execution did **not** help — the same worker ceiling kills background tasks too, and server-side self-chaining (`waitUntil(fetch(nextStage))`) proved unreliable (a worker spawned by an abandoned internal connection is torn down before its own chain fetch fires).
- **Fix:** `forge-analyze` is now a **per-stage state machine** — each invocation runs exactly ONE Claude-backed stage (research → audit → analyze → pricing), persists its artifact to the new **`pipeline_state` JSONB** column (**migration 008**), advances `status`, and returns. The **frontend drives the chain**: `runAnalyze()` in `AnalysisDetailPage` loops, calling `forge-analyze` once per stage until `status==='complete'`. Each stage stays well under the wall-clock limit; the state cursor makes it idempotent and retry-safe (a retry from `error`/mid-stage resumes cleanly). Rate-limit is enforced only on the initial start.
- Analyze stage tuned to avoid `WORKER_RESOURCE_LIMIT` (memory): `max_tokens` 8192→6144, compact (non-pretty) dossier/audit JSON in the prompt, and explicit brevity constraints so the JSON completes without truncation.
- **Requires migration 008 + redeploy of `forge-analyze` + the frontend.** Verified end-to-end to `complete` (7 matrix items, deterministic pricing) 2026-07-12.

### 2026-07-11 — Security hardening + SOW features
- **Share-link enumeration fixed:** anon SELECT on `forge_share_links` (no slug predicate, so every active report/brand snapshot was downloadable) replaced with the `forge_share_link_get` SECURITY DEFINER RPC keyed on the full slug (**migration 005**); public viewer reads one row. `forge-analyze` no longer returns/stores stack traces (message only) and is rate-limited via shared `ai_usage_events` (**migration 006**).
- **Editable optimization matrix:** an "Edit plan" mode retitles / retiers / adjusts hours / removes line items with a live deterministically-recomputed total (`src/lib/pricing.ts` mirrors the edge pricing math).
- **Share-link expiry** (set at publish, changeable per link) + delete; **per-brand Stripe Payment Link + deposit %** (**migration 007**) rendering a "Pay deposit" CTA on the public report.
- **Forge→Cameo handoff:** "Generate demo site" on a completed analysis seeds a Cameo project from the dossier and opens cameo.stonecode.ai.
- Analyses list search + delete.
- **Requires migrations 005+006+007 and redeploy of `forge-analyze` before pushing the frontend** (the public viewer depends on the RPC; BrandsPage depends on the payment columns).

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
