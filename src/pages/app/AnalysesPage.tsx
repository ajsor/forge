import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Analysis, Brand } from '../../types'

export default function AnalysesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState('')
  const [context, setContext] = useState('')
  const [brandId, setBrandId] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importReconId, setImportReconId] = useState('')

  useEffect(() => { void load() }, [user?.id])

  const load = async () => {
    setLoading(true)
    const [{ data: a }, { data: b }] = await Promise.all([
      supabase.from('forge_analyses').select('*').order('created_at', { ascending: false }),
      supabase.from('forge_brands').select('*').order('is_default', { ascending: false }).order('created_at', { ascending: false }),
    ])
    setAnalyses((a ?? []) as Analysis[])
    setBrands((b ?? []) as Brand[])
    const def = (b ?? []).find((br: Brand) => br.is_default) ?? (b ?? [])[0]
    if (def) setBrandId((cur) => cur || def.id)
    setLoading(false)
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = target.trim()
    if (t.length < 2) { setError('Enter a company name, website, or LinkedIn URL.'); return }
    setCreating(true)
    setError(null)
    const { data, error } = await supabase
      .from('forge_analyses')
      .insert({
        user_id: user!.id,
        target: t,
        context: context.trim() || null,
        brand_id: brandId || null,
        recon_brief_id: importReconId.trim() || null,
        status: 'pending',
        progress: 0,
      })
      .select('id')
      .single()
    setCreating(false)
    if (error || !data) { setError(error?.message || 'Failed to create analysis.'); return }
    navigate(`/app/analyses/${data.id}`)
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: 38, fontWeight: 700, letterSpacing: '-0.03em' }}>
          Analyses
        </h1>
        <p style={{ color: '#9aa6b8', marginTop: 6, fontSize: 15 }}>
          Drop in an SMB target and Forge generates a branded optimization report with a priced SOW.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5"
        style={{
          background: 'linear-gradient(135deg, rgba(96,165,250,0.06) 0%, rgba(245,158,11,0.04) 100%)',
          border: '1px solid rgba(96,165,250,0.16)',
        }}
      >
        <form onSubmit={create} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: '#5f6b7e' }}>Target</label>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              maxLength={200}
              placeholder="Company name, website, or LinkedIn URL — e.g. acmecorp.com"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', color: '#e6ebf2' }}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: '#5f6b7e' }}>Engagement context (optional)</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              maxLength={600}
              rows={2}
              placeholder="e.g. Pitching a 90-day transformation engagement. Owner is open to AI but budget-sensitive — under $40k preferred."
              className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
              style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', color: '#e6ebf2' }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: '#5f6b7e' }}>Brand for report</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', color: '#e6ebf2' }}
              >
                <option value="">Forge default</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.display_name}{b.is_default ? ' (default)' : ''}</option>
                ))}
              </select>
              {brands.length === 0 && (
                <p style={{ fontSize: 11, color: '#5f6b7e', marginTop: 4 }}>
                  <Link to="/app/brands" style={{ color: '#60a5fa' }}>Create a brand →</Link>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: '#5f6b7e' }}>Seed from Recon brief (optional)</label>
              <input
                value={importReconId}
                onChange={(e) => setImportReconId(e.target.value)}
                placeholder="Recon brief UUID — skips re-research"
                maxLength={36}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', color: '#e6ebf2', fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            {error ? <p style={{ fontSize: 12, color: '#fb7185' }}>{error}</p> : <span />}
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-3 rounded-xl text-sm font-semibold whitespace-nowrap ml-auto flex items-center gap-2"
              style={{
                background: creating ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #60a5fa 0%, #f59e0b 100%)',
                border: 'none',
                color: creating ? '#5f6b7e' : '#0a0e16',
                cursor: creating ? 'default' : 'pointer',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 4l-7 16M4 12h16" />
              </svg>
              {creating ? 'Forging…' : 'Forge analysis'}
            </button>
          </div>
        </form>
      </motion.div>

      {loading ? (
        <div style={{ color: '#5f6b7e', fontSize: 14, textAlign: 'center', padding: 40 }}>Loading…</div>
      ) : analyses.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center flex flex-col items-center gap-4"
          style={{ background: '#111722', border: '1px dashed rgba(255,255,255,0.08)' }}
        >
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: 22, fontWeight: 600 }}>No analyses yet</h3>
          <p style={{ color: '#9aa6b8', fontSize: 14 }}>Forge your first SMB optimization report above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {analyses.map((a, i) => <AnalysisRow key={a.id} a={a} index={i} brand={brands.find(b => b.id === a.brand_id) ?? null} />)}
        </div>
      )}
    </div>
  )
}

function AnalysisRow({ a, index, brand }: { a: Analysis; index: number; brand: Brand | null }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
      <Link
        to={`/app/analyses/${a.id}`}
        className="flex items-center gap-4 rounded-xl p-4 transition-all hover:scale-[1.005]"
        style={{ background: '#111722', border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none', color: 'inherit' }}
      >
        <StatusBadge status={a.status} progress={a.progress} />
        <div className="flex-1 min-w-0">
          <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 16, fontWeight: 600, color: '#e6ebf2' }}>
            {a.company_name || a.target}
          </div>
          <div style={{ fontSize: 12, color: '#9aa6b8', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
            {brand && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: brand.color_primary + '18', color: brand.color_primary, fontSize: 11 }}>
                {brand.display_name}
              </span>
            )}
            {a.context && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.context}</span>}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#5f6b7e' }}>{new Date(a.created_at).toLocaleDateString()}</div>
      </Link>
    </motion.div>
  )
}

function StatusBadge({ status, progress }: { status: Analysis['status']; progress: number }) {
  const map = {
    pending:     { c: '#9aa6b8', bg: 'rgba(154,166,184,0.12)', label: 'Pending' },
    researching: { c: '#60a5fa', bg: 'rgba(96,165,250,0.12)', label: `Researching ${progress}%` },
    analyzing:   { c: '#a78bfa', bg: 'rgba(167,139,250,0.12)', label: `Analyzing ${progress}%` },
    pricing:     { c: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: `Pricing ${progress}%` },
    complete:    { c: '#34d399', bg: 'rgba(52,211,153,0.12)', label: 'Ready' },
    error:       { c: '#fb7185', bg: 'rgba(251,113,133,0.12)', label: 'Failed' },
  }[status]
  return (
    <span
      className="px-2.5 py-1 rounded-md text-xs font-medium flex-shrink-0"
      style={{ background: map.bg, color: map.c, border: `1px solid ${map.c}33` }}
    >
      {map.label}
    </span>
  )
}
