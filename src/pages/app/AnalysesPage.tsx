import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Analysis, Brand } from '../../types'

interface ReconBriefOption {
  id: string
  company_name: string | null
  target: string
  created_at: string
}

interface ViewInfo {
  viewed: boolean
  lastViewedAt: string | null
}

function accountKey(a: Analysis): string {
  return (a.company_name || a.target).trim().toLowerCase()
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const hours = Math.round(diffMs / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export default function AnalysesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'mine' | 'team'>('mine')
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [teamAnalyses, setTeamAnalyses] = useState<Analysis[]>([])
  const [teamLoaded, setTeamLoaded] = useState(false)
  const [brands, setBrands] = useState<Brand[]>([])
  const [reconBriefs, setReconBriefs] = useState<ReconBriefOption[]>([])
  const [viewInfo, setViewInfo] = useState<Record<string, ViewInfo>>({})
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState('')
  const [context, setContext] = useState('')
  const [brandId, setBrandId] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importReconId, setImportReconId] = useState('')
  const [query, setQuery] = useState('')
  const [groupByAccount, setGroupByAccount] = useState(false)

  const load = async () => {
    setLoading(true)
    const [{ data: a }, { data: b }, { data: rb }] = await Promise.all([
      supabase.from('forge_analyses').select('*').order('created_at', { ascending: false }),
      supabase.from('forge_brands').select('*').order('is_default', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('recon_briefs').select('id, company_name, target, created_at').eq('status', 'complete').order('created_at', { ascending: false }).limit(50),
    ])
    const rows = (a ?? []) as Analysis[]
    setAnalyses(rows)
    setBrands((b ?? []) as Brand[])
    setReconBriefs((rb ?? []) as ReconBriefOption[])
    const def = (b ?? []).find((br: Brand) => br.is_default) ?? (b ?? [])[0]
    if (def) setBrandId((cur) => cur || def.id)
    void loadViewInfo(rows.map((r) => r.id))
    setLoading(false)
  }

  const loadViewInfo = async (analysisIds: string[]) => {
    if (analysisIds.length === 0) return
    const { data } = await supabase
      .from('forge_share_links')
      .select('analysis_id, view_count, last_viewed_at')
      .in('analysis_id', analysisIds)
    if (!data) return
    const map: Record<string, ViewInfo> = {}
    for (const l of data as Array<{ analysis_id: string; view_count: number; last_viewed_at: string | null }>) {
      const prev = map[l.analysis_id]
      const viewed = l.view_count > 0
      if (!prev || (viewed && (!prev.lastViewedAt || (l.last_viewed_at ?? '') > prev.lastViewedAt))) {
        map[l.analysis_id] = { viewed: viewed || prev?.viewed || false, lastViewedAt: l.last_viewed_at ?? prev?.lastViewedAt ?? null }
      }
    }
    setViewInfo(map)
  }

  const loadTeam = async () => {
    const { data, error } = await supabase
      .from('forge_analyses')
      .select('*')
      .eq('shared', true)
      .order('created_at', { ascending: false })
    if (!error) setTeamAnalyses((data ?? []) as Analysis[])
    setTeamLoaded(true)
  }

  useEffect(() => { void load() }, [user?.id])

  useEffect(() => {
    if (tab === 'team' && !teamLoaded) void loadTeam()
  }, [tab, teamLoaded])

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
        recon_brief_id: importReconId || null,
        status: 'pending',
        progress: 0,
      })
      .select('id')
      .single()
    setCreating(false)
    if (error || !data) { setError(error?.message || 'Failed to create analysis.'); return }
    navigate(`/app/analyses/${data.id}`)
  }

  const deleteAnalysis = async (id: string) => {
    if (!confirm('Delete this analysis and its share links? This can’t be undone.')) return
    const { error } = await supabase.from('forge_analyses').delete().eq('id', id)
    if (!error) setAnalyses((prev) => prev.filter((a) => a.id !== id))
  }

  const activeAnalyses = tab === 'mine' ? analyses : teamAnalyses

  const filtered = query.trim()
    ? activeAnalyses.filter((a) => {
        const q = query.toLowerCase()
        return (a.company_name ?? '').toLowerCase().includes(q) ||
          a.target.toLowerCase().includes(q) ||
          (a.context ?? '').toLowerCase().includes(q)
      })
    : activeAnalyses

  const accountCounts = new Map<string, number>()
  for (const a of activeAnalyses) accountCounts.set(accountKey(a), (accountCounts.get(accountKey(a)) ?? 0) + 1)

  const groups: Array<{ key: string; label: string; items: Analysis[] }> = []
  if (groupByAccount) {
    const map = new Map<string, Analysis[]>()
    for (const a of filtered) {
      const k = accountKey(a)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(a)
    }
    for (const [k, items] of map.entries()) groups.push({ key: k, label: items[0].company_name || items[0].target, items })
    groups.sort((a, b) => new Date(b.items[0].created_at).getTime() - new Date(a.items[0].created_at).getTime())
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
              <select
                value={importReconId}
                onChange={(e) => setImportReconId(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', color: '#e6ebf2' }}
              >
                <option value="">— skip, research fresh —</option>
                {reconBriefs.map((rb) => (
                  <option key={rb.id} value={rb.id}>
                    {rb.company_name || rb.target} · {new Date(rb.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
              {reconBriefs.length === 0 && (
                <p style={{ fontSize: 11, color: '#5f6b7e', marginTop: 4 }}>No completed Recon briefs yet.</p>
              )}
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

      <div className="flex items-center gap-2 flex-wrap">
        <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>Mine</TabButton>
        <TabButton active={tab === 'team'} onClick={() => setTab('team')}>Team</TabButton>
        <div style={{ flex: 1 }} />
        {activeAnalyses.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs" style={{ color: '#9aa6b8', cursor: 'pointer' }}>
            <input type="checkbox" checked={groupByAccount} onChange={(e) => setGroupByAccount(e.target.checked)} />
            Group by account
          </label>
        )}
      </div>

      {(tab === 'mine' ? loading : tab === 'team' && !teamLoaded) ? (
        <div style={{ color: '#5f6b7e', fontSize: 14, textAlign: 'center', padding: 40 }}>Loading…</div>
      ) : activeAnalyses.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center flex flex-col items-center gap-4"
          style={{ background: '#111722', border: '1px dashed rgba(255,255,255,0.08)' }}
        >
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: 22, fontWeight: 600 }}>
            {tab === 'mine' ? 'No analyses yet' : 'No shared analyses yet'}
          </h3>
          <p style={{ color: '#9aa6b8', fontSize: 14 }}>
            {tab === 'mine' ? 'Forge your first SMB optimization report above.' : 'Analyses a teammate shares with the team will show up here.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search analyses…"
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
            style={{ background: '#111722', border: '1px solid rgba(255,255,255,0.08)', color: '#e6ebf2' }}
          />
          {filtered.length === 0 ? (
            <p style={{ color: '#5f6b7e', fontSize: 14, textAlign: 'center', padding: 24 }}>No analyses match “{query}”.</p>
          ) : groupByAccount ? (
            <div className="flex flex-col gap-5">
              {groups.map((g) => (
                <div key={g.key} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2" style={{ fontSize: 12.5, color: '#5f6b7e' }}>
                    <span style={{ fontWeight: 600, color: '#9aa6b8' }}>{g.label}</span>
                    {g.items.length > 1 && <span>· {g.items.length} analyses</span>}
                  </div>
                  <div className="flex flex-col gap-2">
                    {g.items.map((a, i) => (
                      <AnalysisRow key={a.id} a={a} index={i} brand={brands.find(b => b.id === a.brand_id) ?? null} viewInfo={viewInfo[a.id]} showOwnerControls={tab === 'mine'} onDelete={deleteAnalysis} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((a, i) => (
                <AnalysisRow
                  key={a.id}
                  a={a}
                  index={i}
                  brand={brands.find(b => b.id === a.brand_id) ?? null}
                  viewInfo={viewInfo[a.id]}
                  showOwnerControls={tab === 'mine'}
                  accountCount={accountCounts.get(accountKey(a)) ?? 1}
                  onDelete={deleteAnalysis}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold"
      style={{
        background: active ? 'rgba(96,165,250,0.14)' : 'transparent',
        border: `1px solid ${active ? 'rgba(96,165,250,0.35)' : 'rgba(255,255,255,0.08)'}`,
        color: active ? '#93c5fd' : '#9aa6b8',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function AnalysisRow({
  a,
  index,
  brand,
  viewInfo,
  showOwnerControls,
  accountCount,
  onDelete,
}: {
  a: Analysis
  index: number
  brand: Brand | null
  viewInfo?: ViewInfo
  showOwnerControls: boolean
  accountCount?: number
  onDelete: (id: string) => void
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="flex items-stretch gap-2">
      <Link
        to={`/app/analyses/${a.id}`}
        className="flex items-center gap-4 rounded-xl p-4 transition-all hover:scale-[1.005] flex-1 min-w-0"
        style={{ background: '#111722', border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none', color: 'inherit' }}
      >
        <StatusBadge status={a.status} progress={a.progress} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 16, fontWeight: 600, color: '#e6ebf2' }}>
              {a.company_name || a.target}
            </span>
            {a.shared && (
              <span style={{ fontSize: 10.5, fontWeight: 600, color: '#c4b5fd', background: 'rgba(196,181,253,0.12)', border: '1px solid rgba(196,181,253,0.3)', borderRadius: 6, padding: '1px 6px' }}>
                Shared
              </span>
            )}
            {viewInfo?.viewed && (
              <span style={{ fontSize: 10.5, fontWeight: 600, color: '#34d399', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 6, padding: '1px 6px' }}>
                👁 Viewed{viewInfo.lastViewedAt ? ` ${relativeTime(viewInfo.lastViewedAt)}` : ''}
              </span>
            )}
            {!!accountCount && accountCount > 1 && (
              <span style={{ fontSize: 10.5, color: '#5f6b7e' }}>· {accountCount} analyses on this account</span>
            )}
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
      {showOwnerControls && (
        <button
          onClick={() => onDelete(a.id)}
          aria-label="Delete analysis"
          className="rounded-xl px-3 flex items-center justify-center flex-shrink-0"
          style={{ background: '#111722', border: '1px solid rgba(255,255,255,0.06)', color: '#8b93a7', cursor: 'pointer' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      )}
    </motion.div>
  )
}

function StatusBadge({ status, progress }: { status: Analysis['status']; progress: number }) {
  const map = {
    pending:     { c: '#9aa6b8', bg: 'rgba(154,166,184,0.12)', label: 'Pending' },
    researching: { c: '#60a5fa', bg: 'rgba(96,165,250,0.12)', label: `Researching ${progress}%` },
    auditing:    { c: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  label: `Auditing ${progress}%` },
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
