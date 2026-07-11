import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Brand } from '../../types'

const BLANK = (): Partial<Brand> => ({
  name: '',
  display_name: '',
  tagline: '',
  color_primary: '#60a5fa',
  color_accent: '#f59e0b',
  font_family: 'Inter, system-ui, sans-serif',
  logo_url: '',
  contact_email: '',
  contact_phone: '',
  contact_website: '',
  legal_entity: '',
  legal_jurisdiction: '',
  cover_letter_template: 'Dear {{company_name}} team,\n\nWe analyzed your operations and identified specific opportunities to drive measurable outcomes. The plan below details what we propose, the work involved, and a transparent investment quote.\n\nLet\'s discuss what resonates.',
  show_stonecode_attribution: false,
  payment_url: '',
  deposit_pct: null,
  is_default: false,
})

export default function BrandsPage() {
  const { user } = useAuth()
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Brand> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { void load() }, [user?.id])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('forge_brands').select('*').order('is_default', { ascending: false }).order('created_at', { ascending: false })
    setBrands((data ?? []) as Brand[])
    setLoading(false)
  }

  const save = async () => {
    if (!editing || !user) return
    setSaving(true); setError(null)
    const payload = { ...editing, user_id: user.id, updated_at: new Date().toISOString() }
    let resp
    if (editing.id) {
      resp = await supabase.from('forge_brands').update(payload).eq('id', editing.id).select('*').single()
    } else {
      resp = await supabase.from('forge_brands').insert(payload).select('*').single()
    }
    setSaving(false)
    if (resp.error) { setError(resp.error.message); return }
    setEditing(null)
    await load()
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this brand?')) return
    await supabase.from('forge_brands').delete().eq('id', id)
    await load()
  }

  const setDefault = async (id: string) => {
    // Clear other defaults then set this one — relies on the unique partial index to enforce a single default
    await supabase.from('forge_brands').update({ is_default: false }).neq('id', id).eq('user_id', user!.id)
    await supabase.from('forge_brands').update({ is_default: true }).eq('id', id)
    await load()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>Brands</h1>
          <p style={{ color: '#9aa6b8', fontSize: 13, marginTop: 4 }}>
            White-label templates for the reports you deliver to prospects.
          </p>
        </div>
        <button onClick={() => setEditing(BLANK())} style={btnPrimary}>
          + New brand
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#5f6b7e', fontSize: 14, textAlign: 'center', padding: 40 }}>Loading…</div>
      ) : brands.length === 0 && !editing ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: '#111722', border: '1px dashed rgba(255,255,255,0.08)' }}
        >
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: 20, fontWeight: 600 }}>No brands yet</h3>
          <p style={{ color: '#9aa6b8', fontSize: 14, marginTop: 6 }}>
            Create a brand to white-label your reports.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {brands.map((b) => (
            <div key={b.id} className="rounded-xl p-4" style={{ background: '#111722', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  {b.logo_url ? (
                    <img src={b.logo_url} alt={b.display_name} style={{ height: 28, width: 'auto' }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: b.color_primary, color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {b.display_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#e6ebf2' }}>{b.display_name}</div>
                    <div style={{ fontSize: 11.5, color: '#5f6b7e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.tagline || b.name}</div>
                  </div>
                </div>
                {b.is_default && <Pill color="#34d399">Default</Pill>}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Swatch color={b.color_primary} />
                <Swatch color={b.color_accent} />
                <div style={{ fontSize: 11, color: '#9aa6b8' }}>{b.font_family.split(',')[0]}</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setEditing(b)} style={btnTinySecondary}>Edit</button>
                {!b.is_default && <button onClick={() => setDefault(b.id)} style={btnTinySecondary}>Set default</button>}
                <button onClick={() => remove(b.id)} style={{ ...btnTinySecondary, color: '#fb7185' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <BrandEditor
          brand={editing}
          onChange={setEditing}
          onSave={save}
          onCancel={() => setEditing(null)}
          saving={saving}
          error={error}
        />
      )}
    </div>
  )
}

function BrandEditor({
  brand, onChange, onSave, onCancel, saving, error,
}: {
  brand: Partial<Brand>
  onChange: (b: Partial<Brand>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  error: string | null
}) {
  const setField = <K extends keyof Brand>(k: K, v: Brand[K]) => onChange({ ...brand, [k]: v })
  return (
    <div className="rounded-2xl p-5" style={{ background: '#0d1219', border: '1px solid rgba(96,165,250,0.18)' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: 20, fontWeight: 600 }}>
          {brand.id ? 'Edit brand' : 'New brand'}
        </h2>
        <button onClick={onCancel} style={btnTinySecondary}>Cancel</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Brand name (internal)"><Input value={brand.name ?? ''} onChange={(v) => setField('name', v)} /></Field>
        <Field label="Display name (on report)"><Input value={brand.display_name ?? ''} onChange={(v) => setField('display_name', v)} /></Field>
        <Field label="Tagline" full><Input value={brand.tagline ?? ''} onChange={(v) => setField('tagline', v)} /></Field>

        <Field label="Primary color"><ColorInput value={brand.color_primary ?? '#60a5fa'} onChange={(v) => setField('color_primary', v)} /></Field>
        <Field label="Accent color"><ColorInput value={brand.color_accent ?? '#f59e0b'} onChange={(v) => setField('color_accent', v)} /></Field>

        <Field label="Font family (CSS)" full><Input value={brand.font_family ?? ''} onChange={(v) => setField('font_family', v)} placeholder="Inter, system-ui, sans-serif" /></Field>

        <Field label="Logo URL" full><Input value={brand.logo_url ?? ''} onChange={(v) => setField('logo_url', v)} placeholder="https://… or data: URL" /></Field>

        <Field label="Contact email"><Input value={brand.contact_email ?? ''} onChange={(v) => setField('contact_email', v)} /></Field>
        <Field label="Contact phone"><Input value={brand.contact_phone ?? ''} onChange={(v) => setField('contact_phone', v)} /></Field>
        <Field label="Website" full><Input value={brand.contact_website ?? ''} onChange={(v) => setField('contact_website', v)} placeholder="https://…" /></Field>

        <Field label="Legal entity (for SOW)"><Input value={brand.legal_entity ?? ''} onChange={(v) => setField('legal_entity', v)} placeholder="Acme Consulting LLC" /></Field>
        <Field label="Jurisdiction"><Input value={brand.legal_jurisdiction ?? ''} onChange={(v) => setField('legal_jurisdiction', v)} placeholder="State of Delaware, USA" /></Field>

        <Field label="Deposit / payment link (Stripe Payment Link or any checkout URL)" full hint="Shows a 'Pay deposit' button on share links">
          <Input value={brand.payment_url ?? ''} onChange={(v) => setField('payment_url', v)} placeholder="https://buy.stripe.com/…" />
        </Field>
        <Field label="Suggested deposit %" hint="Optional — drives the amount on the button">
          <input
            type="number"
            min={0}
            max={100}
            value={brand.deposit_pct ?? ''}
            onChange={(e) => setField('deposit_pct', e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value))))}
            placeholder="e.g. 25"
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
        </Field>

        <Field label="Cover letter template" full hint="Supports {{company_name}}">
          <textarea
            value={brand.cover_letter_template ?? ''}
            onChange={(e) => setField('cover_letter_template', e.target.value)}
            rows={6}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-y"
            style={inputStyle}
          />
        </Field>

        <Field label="" full>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!brand.show_stonecode_attribution}
              onChange={(e) => setField('show_stonecode_attribution', e.target.checked)}
            />
            Show "Implementation powered by stonecode.ai" in report footer
          </label>
        </Field>
      </div>

      {error && <p style={{ color: '#fb7185', fontSize: 12, marginTop: 12 }}>{error}</p>}

      <div className="flex items-center justify-end gap-2 mt-5">
        <button onClick={onCancel} style={btnTinySecondary}>Cancel</button>
        <button onClick={onSave} disabled={saving} style={btnPrimary}>
          {saving ? 'Saving…' : 'Save brand'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children, full, hint }: { label: string; children: React.ReactNode; full?: boolean; hint?: string }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined }}>
      <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5f6b7e', marginBottom: 4 }}>
        {label}{hint && <span style={{ marginLeft: 6, textTransform: 'none', letterSpacing: 0, color: '#9aa6b8' }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
      style={inputStyle}
    />
  )
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', cursor: 'pointer' }}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
        style={{ ...inputStyle, fontFamily: 'monospace' }}
      />
    </div>
  )
}

function Swatch({ color }: { color: string }) {
  return <div style={{ width: 18, height: 18, borderRadius: 5, background: color, border: '1px solid rgba(255,255,255,0.1)' }} />
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, background: color + '22', color, fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', border: `1px solid ${color}55` }}>
      {children}
    </span>
  )
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

const btnTinySecondary: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 8,
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.10)',
  color: '#9aa6b8',
  fontSize: 11.5,
  cursor: 'pointer',
}
