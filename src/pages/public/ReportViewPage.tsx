import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import type { AnalysisReport, Brand, ShareLink } from '../../types'
import ReportView from '../../components/report/ReportView'
import LoadingScreen from '../../components/ui/LoadingScreen'

// Anonymous client (no session) — the public viewer relies on RLS allowing
// SELECT on active share links to the anon role and a SECURITY DEFINER RPC
// for view_count.
const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export default function ReportViewPage() {
  const { slug } = useParams<{ slug: string }>()
  const [link, setLink] = useState<ShareLink | null>(null)
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [brand, setBrand] = useState<Brand | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    const run = async () => {
      const anon = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
      const { data } = await anon
        .from('forge_share_links')
        .select('id, slug, brand_snapshot, report_snapshot, company_name, is_active, view_count, expires_at, created_at, analysis_id, user_id')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle()
      if (cancelled) return
      if (!data) { setNotFound(true); return }
      const r = data as unknown as ShareLink
      setLink(r)
      setReport(r.report_snapshot)
      setBrand(r.brand_snapshot)
      // Fire and forget view bump — ignore errors
      try { await anon.rpc('forge_share_link_view', { p_slug: slug }) } catch { /* swallow */ }
    }
    void run()
    return () => { cancelled = true }
  }, [slug])

  // Apply brand font + background to the document body for the public viewer
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    document.body.style.background = '#f8fafc'
    document.body.style.color = '#111827'
    if (brand?.font_family) document.body.style.fontFamily = brand.font_family
    return () => {
      document.documentElement.classList.add('dark')
      document.body.style.background = ''
      document.body.style.color = ''
      document.body.style.fontFamily = ''
    }
  }, [brand])

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: '#475569' }}>
        <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: 28 }}>Report not found</h1>
        <p style={{ fontSize: 14 }}>This link may have been disabled or has expired.</p>
      </div>
    )
  }

  if (!report || !link) return <LoadingScreen message="Loading report…" />

  return (
    <div style={{ minHeight: '100vh', padding: '24px 12px 48px' }}>
      <div className="no-print" style={{ maxWidth: 920, margin: '0 auto 12px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            background: brand?.color_primary || '#60a5fa',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12.5,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          Save as PDF
        </button>
      </div>
      <ReportView report={report} brand={brand} companyName={link.company_name} preview={false} />
    </div>
  )
}
