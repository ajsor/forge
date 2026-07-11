// Lightweight per-user rate limiting for AI edge functions, backed by the
// shared `ai_usage_events` table (see the 006_*_rate_limit.sql migration —
// the table is created idempotently, once, on the shared project).
//
// Each app calls enforceRateLimit() at the top of an AI action with a service-
// role client. It counts the caller's recent events in a rolling window and
// records this one; over the cap, it throws RateLimitError (map to HTTP 429).

// Structural type so this file doesn't couple to a specific supabase-js import.
interface MinimalClient {
  // deno-lint-ignore no-explicit-any
  from(table: string): any
}

export class RateLimitError extends Error {
  constructor(public windowMinutes: number, public max: number) {
    super(`Rate limit exceeded: max ${max} per ${windowMinutes} minutes.`)
    this.name = 'RateLimitError'
  }
}

export async function enforceRateLimit(
  admin: MinimalClient,
  userId: string,
  app: string,
  action: string,
  opts: { max: number; windowMinutes: number },
): Promise<void> {
  const { max, windowMinutes } = opts
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString()
  const { count } = await admin
    .from('ai_usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('app', app)
    .gte('created_at', since)
  if ((count ?? 0) >= max) throw new RateLimitError(windowMinutes, max)
  try {
    await admin.from('ai_usage_events').insert({ user_id: userId, app, action })
  } catch (_) {
    /* ignore */
  }
}
