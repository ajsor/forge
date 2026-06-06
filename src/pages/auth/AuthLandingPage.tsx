import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { bootstrapSessionFromHash, PORTAL_URL } from '@stonecode/portal-sdk'
import { supabase } from '../../lib/supabase'
import LoadingScreen from '../../components/ui/LoadingScreen'

const STONECODE_URL = import.meta.env.VITE_STONECODE_URL || PORTAL_URL

export default function AuthLandingPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const run = async () => {
      try {
        const result = await bootstrapSessionFromHash(supabase)
        if (result.session) {
          navigate('/app/analyses', { replace: true })
          return
        }
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          navigate('/app/analyses', { replace: true })
          return
        }
        window.location.href = STONECODE_URL
      } catch {
        window.location.href = STONECODE_URL
      }
    }
    run()
  }, [navigate])

  return <LoadingScreen message="Stoking the forge…" />
}
