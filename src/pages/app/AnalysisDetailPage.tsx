import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase, callEdgeFunction, EdgeFunctionError } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Analysis, Brand, ShareLink, RateCard, OptimizationItem, Tier } from '../../types'
import ReportView from '../../components/report/ReportView'
import LoadingScreen from '../../components/ui/LoadingScreen'
import { randomSlug, slugify, formatMoney } from '../../lib/format'
import { computePricing, buildRoadmap, rateCardFromPricing, effortForHours } from '../../lib/pricing'

const CAMEO_URL = 'https://cameo.stonecode.ai'

// Expiry options for share links.
const EXPIRY_CHOICES: { label: string; days: number }[] = [
  { label: 'No expiry', days: 0 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

function expiryToIso(days: number): string | null {
  return days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null
}

export default function AnalysisDetailPage() {
  const { analysisId } = useParams<{ analysisId: string }>()
  const { user } = useAuth()
  const [a, setA] = useState<Analysis | null>(null)
  const [brand, setBrand] = useState<Brand | null>(null)
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([])
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [publishExpiryDays, setPublishExpiryDays] = useState(0)
  const startedRef = useRef(false)

  // Edit-plan state
  const [editing, setEditing] = useState(false)
  const [draftMatrix, setDraftMatrix] = useState<OptimizationItem[]>([])
  const [rateCard, setRateCard] = useState<RateCard | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [sendingToCameo, setSendingToCameo] = useState(false)

  // Initial load
  useEffect(() => {
    if (!analysisId) return
    let cancelled = false
    const load = async () => {
      const { data, error } = await supabase.from('forge_analyses').select('*').eq('id', analysisId).maybeSingle()
      if (cancelled) return
      if (error || !data) { setError(error?.message || 'Not found'); return }
      setA(data as Analysis)
      if (data.brand_id) {
        const { data: br } = await supabase.from('forge_brands').select('*').eq('id', data.brand_id).maybeSingle()
        if (!cancelled) setBrand((br as Brand) ?? null)
      }
      const { data: links } = await supabase.from('forge_share_links').select('*').eq('analysis_id', analysisId).order('created_at', { ascending: false })
      if (!cancelled) setShareLinks((links ?? []) as ShareLink[])
    }
    void load()
    return () => { cancelled = true }
  }, [analysisId])

  // Auto-trigger analyze on a freshly-pending row
  useEffect(() => {
    if (!a || running || startedRef.current) return
    if (a.status === 'pending') {
      startedRef.current = true
      void runAnalyze()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id, a?.status])

  // Poll while running
  useEffect(() => {
    if (!a || !analysisId) return
    const active = a.status === 'researching' || a.status === 'auditing' || a.status === 'analyzing' || a.status === 'pricing'
    if (!active) return
    const interval = setInterval(async () => {
      const { data } = await supabase.from('forge_analyses').select('*').eq('id', analysisId).maybeSingle()
      if (data) setA(data as Analysis)
    }, 1800)
    return () => clearInterval(interval)
  }, [a?.status, analysisId])

  const runAnalyze = async () => {
    if (!analysisId) return
    setRunning(true)
    setError(null)
    try {
      // The pipeline runs one stage per invocation (each stays under the edge
      // wall-clock limit). Re-invoke for the next stage until the report is
      // complete, refreshing the row between stages so the progress bar moves.
      for (let i = 0; i < 6; i++) {
        const res = await callEdgeFunction<{ status?: string; done?: boolean }>(
          'forge-analyze',
          { analysis_id: analysisId },
        )
        const { data } = await supabase.from('forge_analyses').select('*').eq('id', analysisId).maybeSingle()
        if (data) setA(data as Analysis)
        const status = (data as Analysis | null)?.status
        if (res?.status === 'complete' || res?.done || status === 'complete' || status === 'error') break
      }
    } catch (err) {
      setError(friendlyError(err))
      const { data } = await supabase.from('forge_analyses').select('*').eq('id', analysisId).maybeSingle()
      if (data) setA(data as Analysis)
    } finally {
      setRunning(false)
    }
  }

  const publish = async () => {
    if (!a || !user || !a.report) return
    const slug = randomSlug()
    const { data, error } = await supabase
      .from('forge_share_links')
      .insert({
        analysis_id: a.id,
        user_id: user.id,
        slug,
        brand_snapshot: brand,
        report_snapshot: a.report,
        company_name: a.company_name,
        is_active: true,
        expires_at: expiryToIso(publishExpiryDays),
      })
      .select('*')
      .single()
    if (error || !data) { setError(error?.message || 'Failed to publish link.'); return }
    setShareLinks((prev) => [data as ShareLink, ...prev])
  }

  const toggleLink = async (id: string, active: boolean) => {
    await supabase.from('forge_share_links').update({ is_active: active }).eq('id', id)
    setShareLinks((prev) => prev.map((l) => l.id === id ? { ...l, is_active: active } : l))
  }

  const setLinkExpiry = async (id: string, days: number) => {
    const expires_at = expiryToIso(days)
    await supabase.from('forge_share_links').update({ expires_at }).eq('id', id)
    setShareLinks((prev) => prev.map((l) => l.id === id ? { ...l, expires_at } : l))
  }

  const deleteLink = async (id: string) => {
    if (!confirm('Delete this share link? Anyone holding the URL will lose access.')) return
    await supabase.from('forge_share_links').delete().eq('id', id)
    setShareLinks((prev) => prev.filter((l) => l.id !== id))
  }

  /* ── Edit plan ─────────────────────────────────────────────────── */

  const startEdit = async () => {
    if (!a?.report) return
    setDraftMatrix(a.report.optimization_matrix.map((m) => ({ ...m })))
    setError(null)
    // Pull the current rate card for the tier multipliers (not stored in the
    // pricing snapshot). Fall back to a card reconstructed from the snapshot.
    const { data: rc } = await supabase.from('forge_rate_card').select('*').eq('user_id', user!.id).maybeSingle()
    setRateCard((rc as RateCard) ?? null)
    setEditing(true)
  }

  const effectiveRate = (): RateCard =>
    rateCard ?? (a?.report ? rateCardFromPricing(a.report.pricing) : rateCardFromPricing({
      hourly_rate: 150, currency: 'USD', line_items: [], tier_totals: [], subtotal: 0,
      bundle_discount_pct: 0, bundle_discount_amount: 0, total: 0,
    }))

  const updateItem = (idx: number, patch: Partial<OptimizationItem>) =>
    setDraftMatrix((m) => m.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const removeItem = (idx: number) => setDraftMatrix((m) => m.filter((_, i) => i !== idx))

  const saveEdit = async () => {
    if (!a?.report) return
    setSavingEdit(true)
    try {
      const normalized: OptimizationItem[] = draftMatrix.map((it) => {
        const hours = Math.max(1, Math.round(Number(it.dev_hours) || 1))
        return { ...it, dev_hours: hours, effort: effortForHours(hours), title: it.title.trim() || it.title }
      })
      const rate = effectiveRate()
      const pricing = computePricing(normalized, rate)
      const roadmap = buildRoadmap(normalized)
      const nextReport = { ...a.report, optimization_matrix: normalized, pricing, roadmap }
      const { error } = await supabase.from('forge_analyses').update({ report: nextReport }).eq('id', a.id)
      if (error) throw new Error(error.message)
      setA({ ...a, report: nextReport })
      setEditing(false)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setSavingEdit(false)
    }
  }

  /* ── Forge → Cameo handoff ─────────────────────────────────────── */

  const sendToCameo = async () => {
    if (!a || !a.report || !user) return
    setSendingToCameo(true)
    setError(null)
    try {
      const name = a.company_name || a.target
      const es = a.report.exec_summary
      const strengths = a.report.swot?.strengths?.map((s) => `- ${s.point}: ${s.detail}`).join('\n') ?? ''
      const brandingGuide = [
        es.company_overview,
        es.relative_positioning ? `Positioning: ${es.relative_positioning}` : '',
      ].filter(Boolean).join('\n\n')
      const pasted = [
        es.value_proposition ? `Value proposition: ${es.value_proposition}` : '',
        strengths ? `Strengths:\n${strengths}` : '',
      ].filter(Boolean).join('\n\n')

      const slug = `${slugify(name)}-${randomSlug().slice(0, 4)}`
      const { data, error } = await supabase
        .from('cameo_projects')
        .insert({
          owner_id: user.id,
          business_name: name,
          slug,
          status: 'brief',
          brief: {
            business_name: name,
            one_liner: es.value_proposition ?? '',
            references: [],
            branding_guide: brandingGuide,
            pasted_content: pasted,
            uploaded_image_paths: [],
          },
        })
        .select('id')
        .single()
      if (error || !data) throw new Error(error?.message || 'Failed to create Cameo project')
      window.location.href = `${CAMEO_URL}/app/${data.id}/discover`
    } catch (e) {
      setError(friendlyError(e))
      setSendingToCameo(false)
    }
  }

  const printPdf = () => window.print()

  if (!a) return error ? <ErrorMessage message={error} /> : <LoadingScreen message="Loading analysis…" />

  const livePricing = editing ? computePricing(
    draftMatrix.map((it) => ({ ...it, dev_hours: Math.max(1, Math.round(Number(it.dev_hours) || 1)) })),
    effectiveRate(),
  ) : null

  return (
    <div className="flex flex-col gap-6">
      <div className="no-print flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/app/analyses" style={{ color: '#9aa6b8', textDecoration: 'none', fontSize: 12 }}>← Analyses</Link>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 6 }}>
            {a.company_name || a.target}
          </h1>
          {a.context && <p style={{ color: '#9aa6b8', fontSize: 13, marginTop: 4 }}>{a.context}</p>}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {a.status === 'complete' && !editing && (
            <>
              <button onClick={startEdit} style={btnSecondary}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                Edit plan
              </button>
              <button onClick={sendToCameo} disabled={sendingToCameo} style={btnSecondary}>
                {sendingToCameo ? 'Opening Cameo…' : '✦ Generate demo site'}
              </button>
              <select
                value={publishExpiryDays}
                onChange={(e) => setPublishExpiryDays(Number(e.target.value))}
                style={selectStyle}
                title="Share link expiry"
              >
                {EXPIRY_CHOICES.map((c) => <option key={c.days} value={c.days}>{c.label}</option>)}
              </select>
              <button onClick={publish} style={btnPrimary}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
                Publish share link
              </button>
              <button onClick={printPdf} style={btnSecondary}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print / Save PDF
              </button>
            </>
          )}
          {a.status === 'error' && (
            <button onClick={runAnalyze} disabled={running} style={btnPrimary}>
              {running ? 'Retrying…' : 'Retry'}
            </button>
          )}
        </div>
      </div>

      {/* Progress / status */}
      {(a.status !== 'complete') && (
        <div
          className="no-print rounded-2xl p-5"
          style={{ background: '#111722', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {a.status === 'error' ? (
            <ErrorMessage message={a.error || 'Analysis failed.'} />
          ) : (
            <StagePipeline status={a.status} progress={a.progress} />
          )}
          {error && <p style={{ color: '#fb7185', fontSize: 12, marginTop: 8 }}>{error}</p>}
        </div>
      )}

      {error && a.status === 'complete' && (
        <div className="no-print" style={{ color: '#fb7185', fontSize: 13 }}>{error}</div>
      )}

      {/* Share links */}
      {shareLinks.length > 0 && !editing && (
        <div className="no-print rounded-2xl p-5" style={{ background: '#111722', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5f6b7e', marginBottom: 10 }}>
            Share links
          </div>
          <div className="flex flex-col gap-2.5">
            {shareLinks.map((l) => {
              const url = `${window.location.origin}/r/${l.slug}`
              const expired = l.expires_at ? new Date(l.expires_at) < new Date() : false
              const currentDays = l.expires_at
                ? Math.max(0, Math.round((new Date(l.expires_at).getTime() - Date.now()) / 86_400_000))
                : 0
              return (
                <div key={l.id} className="flex items-center gap-3 flex-wrap" style={{ fontSize: 13 }}>
                  <code style={{ flex: 1, minWidth: 220, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', color: '#e6ebf2', overflowX: 'auto' }}>
                    {url}
                  </code>
                  <button onClick={() => { void navigator.clipboard.writeText(url) }} style={btnTinySecondary}>Copy</button>
                  <a href={url} target="_blank" rel="noreferrer" style={{ ...btnTinySecondary, textDecoration: 'none', textAlign: 'center' as const }}>Open</a>
                  <select
                    value={EXPIRY_CHOICES.some((c) => c.days === currentDays) ? currentDays : 0}
                    onChange={(e) => setLinkExpiry(l.id, Number(e.target.value))}
                    style={selectStyle}
                    title="Expiry"
                  >
                    {EXPIRY_CHOICES.map((c) => <option key={c.days} value={c.days}>{c.label}</option>)}
                  </select>
                  <button onClick={() => toggleLink(l.id, !l.is_active)} style={{ ...btnTinySecondary, color: l.is_active ? '#fb7185' : '#34d399' }}>
                    {l.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => deleteLink(l.id)} style={{ ...btnTinySecondary, color: '#fb7185' }}>Delete</button>
                  <span style={{ fontSize: 11, color: expired ? '#fb7185' : '#5f6b7e' }}>
                    {l.view_count} views{l.expires_at ? (expired ? ' · expired' : ` · expires ${new Date(l.expires_at).toLocaleDateString()}`) : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Edit matrix panel */}
      {editing && a.report && (
        <div className="no-print rounded-2xl p-5" style={{ background: '#111722', border: '1px solid rgba(96,165,250,0.25)' }}>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div>
              <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 15, fontWeight: 600 }}>Edit optimization matrix</div>
              <div style={{ fontSize: 12, color: '#9aa6b8', marginTop: 2 }}>
                Adjust hours, retier, or remove line items. Pricing recomputes deterministically from your rate card.
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} style={btnSecondary}>Cancel</button>
              <button onClick={saveEdit} disabled={savingEdit || draftMatrix.length === 0} style={btnPrimary}>
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {draftMatrix.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2 flex-wrap" style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <input
                  value={item.title}
                  onChange={(e) => updateItem(idx, { title: e.target.value })}
                  style={{ flex: 1, minWidth: 200, ...inputStyle }}
                />
                <select value={item.tier} onChange={(e) => updateItem(idx, { tier: Number(e.target.value) as Tier })} style={selectStyle}>
                  <option value={1}>Tier 1</option>
                  <option value={2}>Tier 2</option>
                  <option value={3}>Tier 3</option>
                </select>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    value={item.dev_hours}
                    onChange={(e) => updateItem(idx, { dev_hours: Math.max(0, Number(e.target.value) || 0) })}
                    style={{ width: 84, ...inputStyle }}
                  />
                  <span style={{ fontSize: 12, color: '#9aa6b8' }}>hrs</span>
                </div>
                <button onClick={() => removeItem(idx)} aria-label="Remove item" style={{ ...btnTinySecondary, color: '#fb7185', padding: '6px 10px' }}>✕</button>
              </div>
            ))}
            {draftMatrix.length === 0 && (
              <p style={{ color: '#9aa6b8', fontSize: 13 }}>All items removed. Add at least one back by cancelling, or save an empty plan.</p>
            )}
          </div>

          {livePricing && (
            <div className="flex items-center justify-end gap-4 mt-4" style={{ fontSize: 13, color: '#cbd5e1' }}>
              <span>Subtotal {formatMoney(livePricing.subtotal, livePricing.currency)}</span>
              {livePricing.bundle_discount_amount > 0 && (
                <span style={{ color: '#60a5fa' }}>−{formatMoney(livePricing.bundle_discount_amount, livePricing.currency)}</span>
              )}
              <span style={{ fontWeight: 700, fontSize: 15 }}>Total {formatMoney(livePricing.total, livePricing.currency)}</span>
            </div>
          )}
        </div>
      )}

      {/* Report */}
      {a.report && !editing && (
        <div className="rounded-2xl" style={{ background: '#0d1219', border: '1px solid rgba(255,255,255,0.06)', padding: 24 }}>
          <ReportView report={a.report} brand={brand} companyName={a.company_name} sources={a.sources} preview />
        </div>
      )}
    </div>
  )
}

function StagePipeline({ status, progress }: { status: Analysis['status']; progress: number }) {
  const stages: { key: Analysis['status']; label: string }[] = [
    { key: 'researching', label: 'Researching' },
    { key: 'auditing',    label: 'Auditing' },
    { key: 'analyzing',   label: 'Analyzing' },
    { key: 'pricing',     label: 'Pricing' },
  ]
  const activeIdx = stages.findIndex((s) => s.key === status)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        {stages.map((s, i) => {
          const isActive = i === activeIdx
          const isDone = i < activeIdx
          const color = isDone ? '#34d399' : isActive ? '#60a5fa' : '#5f6b7e'
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
              <motion.div
                animate={isActive ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={{ duration: 1.4, repeat: Infinity }}
                style={{ width: 12, height: 12, borderRadius: '50%', background: color, opacity: isDone || isActive ? 1 : 0.4 }}
              />
              <div style={{ fontSize: 12.5, color: isActive ? '#e6ebf2' : color, fontWeight: isActive ? 600 : 500 }}>
                {s.label}
              </div>
              {i < stages.length - 1 && (
                <div style={{ flex: 1, height: 1, background: isDone ? '#34d39955' : 'rgba(255,255,255,0.06)', marginLeft: 4 }} />
              )}
            </div>
          )
        })}
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
          style={{ height: '100%', background: 'linear-gradient(90deg, #60a5fa, #f59e0b)' }}
        />
      </div>
      <p style={{ fontSize: 11, color: '#5f6b7e', marginTop: 8 }}>
        Web research → digital presence audit (website, SEO, branding, social) → full SWOT + Optimization Matrix + Roadmap → deterministic pricing. Takes 90–180 seconds.
      </p>
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 10, background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.25)', color: '#fb7185', fontSize: 13 }}>
      {message}
    </div>
  )
}

function friendlyError(e: unknown): string {
  const msg = e instanceof EdgeFunctionError ? e.message : e instanceof Error ? e.message : String(e)
  if (/rate limit/i.test(msg)) return 'You’ve hit the hourly analysis limit. Give it a little while and try again.'
  if (/parse|dossier|JSON/i.test(msg)) return 'The analysis returned something unexpected. Try retrying.'
  return msg || 'Something went wrong. Please try again.'
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
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

const btnSecondary: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 10,
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#cbd5e1',
  fontSize: 12.5,
  fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
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

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#e6ebf2',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 13,
  outline: 'none',
}

const selectStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#e6ebf2',
  borderRadius: 8,
  padding: '6px 8px',
  fontSize: 12.5,
  cursor: 'pointer',
}
