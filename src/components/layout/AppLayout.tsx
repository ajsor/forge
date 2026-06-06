import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import LoadingScreen from '../ui/LoadingScreen'
import { LogoMark, Wordmark } from '../ui/Logo'

const STONECODE_URL = import.meta.env.VITE_STONECODE_URL || 'https://stonecode.ai'

export default function AppLayout() {
  const { loading, session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [signOutHover, setSignOutHover] = useState(false)

  useEffect(() => {
    if (!loading && !session) {
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) window.location.href = STONECODE_URL
      })
    }
  }, [loading, session])

  if (loading) return <LoadingScreen />
  if (!session) return null

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = STONECODE_URL
  }

  const navLinks = [
    { to: '/app/analyses', label: 'Analyses' },
    { to: '/app/brands', label: 'Brands' },
    { to: '/app/rate-card', label: 'Rate card' },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0e16' }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute rounded-full" style={{ width: 640, height: 640, top: '-240px', left: '-200px', background: 'radial-gradient(circle, rgba(96,165,250,0.07) 0%, transparent 70%)', filter: 'blur(85px)' }} />
        <div className="absolute rounded-full" style={{ width: 480, height: 480, bottom: '-180px', right: '-140px', background: 'radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)', filter: 'blur(75px)' }} />
      </div>

      <header
        className="sticky top-0 z-30 px-4 sm:px-6 py-3"
        style={{ background: 'rgba(10,14,22,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-4">
          <button
            onClick={() => navigate('/app/analyses')}
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <LogoMark size={24} />
            <Wordmark />
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((l) => {
              const active = location.pathname === l.to || location.pathname.startsWith(l.to + '/')
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className="px-3 py-2 rounded-lg text-sm transition-all"
                  style={{
                    color: active ? '#e6ebf2' : '#9aa6b8',
                    background: active ? 'rgba(96,165,250,0.10)' : 'transparent',
                    border: '1px solid ' + (active ? 'rgba(96,165,250,0.22)' : 'transparent'),
                    textDecoration: 'none',
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  {l.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.href = STONECODE_URL + '/portal/dashboard'}
              title="Back to stonecode.ai portal"
              className="px-3 py-2 rounded-xl text-sm transition-all hidden sm:flex items-center gap-2"
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#9aa6b8', cursor: 'pointer' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Portal
            </button>

            <button
              onClick={handleSignOut}
              onMouseEnter={() => setSignOutHover(true)}
              onMouseLeave={() => setSignOutHover(false)}
              aria-label="Sign out"
              title="Sign out"
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: signOutHover ? 'rgba(255,255,255,0.04)' : 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#5f6b7e', cursor: 'pointer' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden flex items-center gap-1 mt-2 max-w-6xl mx-auto">
          {navLinks.map((l) => {
            const active = location.pathname === l.to || location.pathname.startsWith(l.to + '/')
            return (
              <Link
                key={l.to}
                to={l.to}
                className="px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{
                  color: active ? '#e6ebf2' : '#9aa6b8',
                  background: active ? 'rgba(96,165,250,0.10)' : 'transparent',
                  border: '1px solid ' + (active ? 'rgba(96,165,250,0.22)' : 'rgba(255,255,255,0.05)'),
                  textDecoration: 'none',
                  fontWeight: active ? 600 : 500,
                }}
              >
                {l.label}
              </Link>
            )
          })}
        </nav>
      </header>

      <main className="relative z-10 flex-1 px-4 sm:px-6 py-8 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
