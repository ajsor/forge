import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { RateCard } from '../../types'
import { formatMoney } from '../../lib/format'

const DEFAULT: Partial<RateCard> = {
  hourly_rate: 150,
  currency: 'USD',
  bundle_discount_pct: 12,
  tier1_multiplier: 1,
  tier2_multiplier: 1,
  tier3_multiplier: 1,
}

export default function RateCardPage() {
  const { user } = useAuth()
  const [rc, setRc] = useState<Partial<RateCard>>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { void load() }, [user?.id])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('forge_rate_card').select('*').maybeSingle()
    if (data) setRc(data as RateCard)
    setLoading(false)
  }

  const save = async () => {
    if (!user) return
    setSaving(true); setError(null); setMessage(null)
    const payload = {
      user_id: user.id,
      hourly_rate: Number(rc.hourly_rate) || 0,
      currency: rc.currency || 'USD',
      bundle_discount_pct: clamp(Number(rc.bundle_discount_pct) || 0, 0, 50),
      tier1_multiplier: Number(rc.tier1_multiplier) || 1,
      tier2_multiplier: Number(rc.tier2_multiplier) || 1,
      tier3_multiplier: Number(rc.tier3_multiplier) || 1,
      updated_at: new Date().toISOString(),
    }
    // upsert on user_id
    const { error } = await supabase
      .from('forge_rate_card')
      .upsert(payload, { onConflict: 'user_id' })
    setSaving(false)
    if (error) { setError(error.message); return }
    setMessage('Saved.')
    setTimeout(() => setMessage(null), 1800)
  }

  if (loading) return <div style={{ color: '#5f6b7e', fontSize: 14, textAlign: 'center', padding: 40 }}>Loading…</div>

  const rate = Number(rc.hourly_rate) || 0
  const exampleHours = 60
  const exampleSubtotal = rate * exampleHours
  const discountAmt = exampleSubtotal * (Number(rc.bundle_discount_pct) || 0) / 100
  const exampleTotal = exampleSubtotal - discountAmt

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>Rate card</h1>
        <p style={{ color: '#9aa6b8', fontSize: 13, marginTop: 4 }}>
          Pricing in every report is computed deterministically from these inputs — Claude estimates hours, Forge multiplies.
        </p>
      </div>

      <div className="rounded-2xl p-5" style={{ background: '#111722', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Hourly rate">
            <NumberInput value={rc.hourly_rate ?? 0} onChange={(v) => setRc({ ...rc, hourly_rate: v })} />
          </Field>
          <Field label="Currency">
            <select
              value={rc.currency ?? 'USD'}
              onChange={(e) => setRc({ ...rc, currency: e.target.value })}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={inputStyle}
            >
              <option>USD</option><option>EUR</option><option>GBP</option><option>CAD</option><option>AUD</option>
            </select>
          </Field>
          <Field label="Bundle discount % (0–50)" full>
            <NumberInput value={rc.bundle_discount_pct ?? 0} onChange={(v) => setRc({ ...rc, bundle_discount_pct: v })} />
          </Field>

          <Field label="Tier 1 multiplier (Quick Wins)">
            <NumberInput value={rc.tier1_multiplier ?? 1} step={0.05} onChange={(v) => setRc({ ...rc, tier1_multiplier: v })} />
          </Field>
          <Field label="Tier 2 multiplier (Mid-term)">
            <NumberInput value={rc.tier2_multiplier ?? 1} step={0.05} onChange={(v) => setRc({ ...rc, tier2_multiplier: v })} />
          </Field>
          <Field label="Tier 3 multiplier (Long-term)" full>
            <NumberInput value={rc.tier3_multiplier ?? 1} step={0.05} onChange={(v) => setRc({ ...rc, tier3_multiplier: v })} />
            <p style={{ fontSize: 11, color: '#5f6b7e', marginTop: 4 }}>
              Multipliers let you charge a premium (e.g. 1.15) or discount (e.g. 0.90) on a tier without changing the base rate.
            </p>
          </Field>
        </div>

        {error && <p style={{ color: '#fb7185', fontSize: 12, marginTop: 12 }}>{error}</p>}
        {message && <p style={{ color: '#34d399', fontSize: 12, marginTop: 12 }}>{message}</p>}

        <div className="flex items-center justify-end mt-5">
          <button onClick={save} disabled={saving} style={btnPrimary}>
            {saving ? 'Saving…' : 'Save rate card'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl p-5" style={{ background: '#0d1219', border: '1px solid rgba(96,165,250,0.18)' }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5f6b7e' }}>Worked example</div>
        <p style={{ fontSize: 13, color: '#cbd5e1', marginTop: 6 }}>
          A 60-hour engagement at {formatMoney(rate, rc.currency)}/hr (Tier 2):
        </p>
        <div style={{ marginTop: 8, fontSize: 14 }}>
          <Row label="Subtotal"  value={formatMoney(exampleSubtotal, rc.currency)} />
          {discountAmt > 0 && <Row label={`Bundle discount (${rc.bundle_discount_pct}%)`} value={`−${formatMoney(discountAmt, rc.currency)}`} accent />}
          <Row label="Total" value={formatMoney(exampleTotal, rc.currency)} bold />
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined }}>
      <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5f6b7e', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

function NumberInput({ value, onChange, step }: { value: number | string; onChange: (n: number) => void; step?: number }) {
  return (
    <input
      type="number"
      step={step ?? 1}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
      style={{ ...inputStyle, fontFamily: 'monospace' }}
    />
  )
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: bold ? '1px solid rgba(255,255,255,0.08)' : 'none', marginTop: bold ? 6 : 0, paddingTop: bold ? 8 : 4, fontWeight: bold ? 700 : 400, color: accent ? '#60a5fa' : '#e6ebf2' }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.35)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#e6ebf2',
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 10,
  background: 'linear-gradient(135deg, #60a5fa 0%, #f59e0b 100%)',
  border: 'none',
  color: '#0a0e16',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
}
