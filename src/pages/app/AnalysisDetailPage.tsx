import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase, callEdgeFunction, EdgeFunctionError } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Analysis, Brand, ShareLink } from '../../types'
import ReportView from '../../components/report/ReportView'
import LoadingScreen from '../../components/ui/LoadingScreen'
import { randomSlug } from '../../lib/format'

export default function AnalysisDetailPage() {
  const { analysisId } = useParams<{ analysisId: string }>()
  const { user } = useAuth()
  const [a, setA] = useState<Analysis | null>(null)
  const [brand, setBrand] = useState<Brand | null>(null)
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([])
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const startedRef = useRef(false)

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
    const active = a.status === 'researching' || a.status === 'analyzing' || a.status === 'pricing'
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
      await callEdgeFunction<{ success: boolean }>('forge-analyze', { analysis_id: analysisId })
      const { data } = await supabase.from('forge_analyses').select('*').eq('id', analysisId).maybeSingle()
      if (data) setA(data as Analysis)
    } catch (err) {
      const m = err instanceof EdgeFunctionError ? err.message : err instanceof Error ? err.message : 'Forge failed'
      setError(m)
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

  const printPdf = () => window.print()

  if (!a) return error ? <ErrorMessage message={error} /> : <LoadingScreen message="Loading analysis…" />

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
          {a.status === 'complete' && (
            <>
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

      {/* Share links */}
      {shareLinks.length > 0 && (
        <div className="no-print rounded-2xl p-5" style={{ background: '#111722', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5f6b7e', marginBottom: 10 }}>
            Share links
          </div>
          <div className="flex flex-col gap-2">
            {shareLinks.map((l) => {
              const url = `${window.location.origin}/r/${l.slug}`
              return (
                <div key={l.id} className="flex items-center gap-3 flex-wrap" style={{ fontSize: 13 }}>
                  <code style={{ flex: 1, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', color: '#e6ebf2', overflowX: 'auto' }}>
                    {url}
                  </code>
                  <button
                    onClick={() => { void navigator.clipboard.writeText(url) }}
                    style={btnTinySecondary}
                  >Copy</button>
                  <a href={url} target="_blank" rel="noreferrer" style={{ ...btnTinySecondary, textDecoration: 'none', textAlign: 'center' as const }}>Open</a>
                  <button onClick={() => toggleLink(l.id, !l.is_active)} style={{ ...btnTinySecondary, color: l.is_active ? '#fb7185' : '#34d399' }}>
                    {l.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <span style={{ fontSize: 11, color: '#5f6b7e' }}>{l.view_count} views</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Report */}
      {a.report && (
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
        Web research, then full SWOT + Optimization Matrix + Roadmap, then deterministic pricing. Takes 60–120 seconds.
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
