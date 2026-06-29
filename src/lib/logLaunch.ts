import { supabase } from './supabase'

const APP_SLUG = 'forge'
const SESSION_KEY = `stonecode:launched:${APP_SLUG}`

// Logs a satellite-app open into the shared app_launches table (defined in
// stonecode.ai migration 030). Powers the admin App Utilization dashboard.
//
// sessionStorage de-dupes: a "launch" is one authenticated entry, not one
// mount or one route navigation. Refreshes within the same tab count once.
//
// Fails silently — telemetry must never block the app from loading.
export async function logLaunchIfFirstThisSession(): Promise<void> {
  try {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(SESSION_KEY)) return
    sessionStorage.setItem(SESSION_KEY, '1')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      sessionStorage.removeItem(SESSION_KEY)
      return
    }
    await supabase.from('app_launches').insert({
      user_id: user.id,
      app: APP_SLUG,
      source: 'satellite-mount',
    })
  } catch (err) {
    console.warn('logLaunchIfFirstThisSession failed:', err)
  }
}
