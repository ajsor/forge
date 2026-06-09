export async function logAppIssue(opts: {
  fn: string
  stage?: string
  detail: string
  userId?: string | null
  severity?: 'warning' | 'error'
  location?: string
}): Promise<void> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return
  try {
    await fetch(`${url}/rest/v1/app_issues`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        app: 'forge',
        severity: opts.severity ?? 'error',
        message: `${opts.fn} failed at ${opts.stage ?? 'unknown'}`,
        details: opts.detail.slice(0, 8000),
        source: 'edge_function',
        location: opts.location ?? opts.fn,
        user_id: opts.userId ?? null,
      }),
    })
  } catch (_) { /* swallow */ }
}
