import Anthropic from 'npm:@anthropic-ai/sdk@0.36.3'
import { logAppIssue } from '../_shared/appIssues.ts'
import { enforceRateLimit, RateLimitError } from '../_shared/rateLimit.ts'

const CORS = {
  'Access-Control-Allow-Origin': 'https://forge.stonecode.ai',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    origin === 'http://localhost:5173' || origin === 'http://localhost:5174'
      ? origin
      : 'https://forge.stonecode.ai'
  return { ...CORS, 'Access-Control-Allow-Origin': allow }
}

const SYSTEM = `You write short, specific follow-up emails for a consultant/agency following up on a Business Optimization Report + priced SOW they sent a prospect.

Standards:
- 120-180 words. Plain text, no markdown, no subject line, no signature block.
- Reference 1-2 concrete things from the report or the deal notes — never generic filler like "just checking in."
- If the deal notes describe an objection, a stalled negotiation, or a specific next step, lead with that.
- If the prospect has viewed the report but not responded, acknowledge that lightly without sounding like a tracking pixel ("noticed you had a chance to look it over" not "our system shows you opened this").
- End with one clear, specific next step or question — not "let me know if you have questions."
- Warm but efficient tone, confident without being pushy. No exclamation points beyond one, if any.
- Output ONLY the email body — no preamble, no commentary.`

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers)

  let stage = 'init'
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401, headers)

    const { createClient } = await import('npm:@supabase/supabase-js@2')
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    stage = 'auth'
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401, headers)

    await enforceRateLimit(supabaseAdmin, user.id, 'forge', 'followup', { max: 30, windowMinutes: 60 })

    const body = await req.json()
    const analysisId = String(body.analysis_id ?? '')
    if (!analysisId || !/^[0-9a-f-]{36}$/i.test(analysisId)) return json({ error: 'Invalid analysis_id' }, 400, headers)

    stage = 'load_analysis'
    const { data: row } = await supabaseAdmin
      .from('forge_analyses')
      .select('id, user_id, target, context, company_name, report, notes, status')
      .eq('id', analysisId)
      .maybeSingle()
    if (!row || row.user_id !== user.id) return json({ error: 'Forbidden' }, 403, headers)
    if (row.status !== 'complete' || !row.report) return json({ error: 'Analysis is not ready yet.' }, 400, headers)

    const notes = String(row.notes ?? '').trim().slice(0, 2000)
    if (!notes) return json({ error: 'Add deal notes first — the follow-up draft is written from them.' }, 400, headers)

    stage = 'load_share_status'
    const { data: links } = await supabaseAdmin
      .from('forge_share_links')
      .select('view_count, last_viewed_at')
      .eq('analysis_id', analysisId)
      .order('last_viewed_at', { ascending: false, nullsFirst: false })
      .limit(1)
    const lastViewedAt = links?.[0]?.last_viewed_at ?? null
    const viewCount = links?.[0]?.view_count ?? 0

    const report = row.report as { exec_summary?: { company_overview?: string; value_proposition?: string } }
    const companyName = String(row.company_name ?? row.target ?? '').slice(0, 160)

    stage = 'anthropic_call'
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
    const userPrompt =
      `COMPANY: ${companyName}\n` +
      (row.context ? `ENGAGEMENT CONTEXT: ${String(row.context).slice(0, 400)}\n` : '') +
      (report.exec_summary?.company_overview ? `REPORT OVERVIEW: ${report.exec_summary.company_overview}\n` : '') +
      `\nSHARE LINK STATUS: ${viewCount > 0 ? `Viewed ${viewCount} time(s), most recently ${new Date(lastViewedAt!).toDateString()}` : 'Not yet viewed'}\n\n` +
      `DEAL NOTES (what actually happened):\n${notes}\n\n` +
      `Write the follow-up email.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    })

    stage = 'parse'
    const draft = message.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
    if (!draft) throw new Error('Could not generate a follow-up draft')

    return json({ draft: draft.slice(0, 4000) }, 200, headers)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return json({ error: err.message }, 429, headers)
    }
    const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
    const publicMsg = err instanceof Error ? err.message : 'Follow-up draft failed'
    console.error('forge-followup error:', detail)
    logAppIssue({ fn: 'forge-followup', stage, detail })
    return json({ error: publicMsg, stage }, 500, headers)
  }
})

function json(payload: unknown, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}
