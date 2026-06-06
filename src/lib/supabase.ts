import { createPortalSupabaseClient } from '@stonecode/portal-sdk'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createPortalSupabaseClient({
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  storageKey: 'forge-auth',
  authOverrides: { detectSessionInUrl: false },
})

export class EdgeFunctionError extends Error {
  status?: number
  reason?: string
  stage?: string
  constructor(message: string, opts: { status?: number; reason?: string; stage?: string } = {}) {
    super(message)
    this.name = 'EdgeFunctionError'
    this.status = opts.status
    this.reason = opts.reason
    this.stage = opts.stage
  }
}

export async function callEdgeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body })
  if (error) {
    let userMessage = error.message
    let reason: string | undefined
    let stage: string | undefined
    let status: number | undefined
    const ctx = (error as unknown as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const parsed = await ctx.clone().json()
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.error === 'string') userMessage = parsed.error
          if (typeof parsed.reason === 'string') reason = parsed.reason
          if (typeof parsed.stage === 'string') stage = parsed.stage
        }
        status = ctx.status
      } catch (_) { /* fall back */ }
    }
    throw new EdgeFunctionError(userMessage, { status, reason, stage })
  }
  return data as T
}
