import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import AppLayout from './components/layout/AppLayout'
import AuthLandingPage from './pages/auth/AuthLandingPage'
import LoadingScreen from './components/ui/LoadingScreen'

const AnalysesPage = lazy(() => import('./pages/app/AnalysesPage'))
const AnalysisDetailPage = lazy(() => import('./pages/app/AnalysisDetailPage'))
const BrandsPage = lazy(() => import('./pages/app/BrandsPage'))
const RateCardPage = lazy(() => import('./pages/app/RateCardPage'))
const ReportViewPage = lazy(() => import('./pages/public/ReportViewPage'))

function Wrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
}

function WithAuth({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <WithAuth>
        <AuthLandingPage />
      </WithAuth>
    ),
  },
  {
    path: '/app',
    element: (
      <WithAuth>
        <AppLayout />
      </WithAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/app/analyses" replace /> },
      { path: 'analyses', element: <Wrap><AnalysesPage /></Wrap> },
      { path: 'analyses/:analysisId', element: <Wrap><AnalysisDetailPage /></Wrap> },
      { path: 'brands', element: <Wrap><BrandsPage /></Wrap> },
      { path: 'rate-card', element: <Wrap><RateCardPage /></Wrap> },
    ],
  },
  {
    // Public, unauthenticated branded report viewer
    path: '/r/:slug',
    element: <Wrap><ReportViewPage /></Wrap>,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
