import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useModerator } from './context/ModeratorContext'
import { useVisitor } from './context/VisitorContext'
import useAnalytics from './hooks/useAnalytics'

// Public pages
import Landing from './pages/Public/Landing'
import Register from './pages/Public/Register'
import Lookup from './pages/Public/Lookup'

// Admin pages
import AdminLogin from './pages/Admin/Login'
import AdminLayout from './components/layout/AdminLayout'
import Dashboard from './pages/Admin/Dashboard'
import EventDays from './pages/Admin/EventDays'
import Rooms from './pages/Admin/Rooms'
import Sessions from './pages/Admin/Sessions'
import Moderators from './pages/Admin/Moderators'
import Assignments from './pages/Admin/Assignments'
import Export from './pages/Admin/Export'
import Analytics from './pages/Admin/Analytics'
import AISettings from './pages/Admin/AISettings'

// Moderator pages
import ModeratorLayout from './components/layout/ModeratorLayout'
import Schedule from './pages/Moderator/Schedule'
import Settings from './pages/Moderator/Settings'

// Visitor pages
import VisitorLogin from './pages/Visitor/Login'
import VisitorRegister from './pages/Visitor/Register'
import Explore from './pages/Visitor/Explore'

function AdminProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />
  }

  return children
}

function ModeratorProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useModerator()

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/lookup" replace />
  }

  return children
}

function VisitorProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useVisitor()

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/visitor/login" replace />
  }

  return children
}

function AnalyticsTracker() {
  const { moderator } = useModerator()
  useAnalytics(moderator?.id || null)
  return null
}

function App() {
  return (
    <>
      <AnalyticsTracker />
      <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/register" element={<Register />} />
      <Route path="/lookup" element={<Lookup />} />

      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <AdminProtectedRoute>
            <AdminLayout />
          </AdminProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="days" element={<EventDays />} />
        <Route path="rooms" element={<Rooms />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="moderators" element={<Moderators />} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="export" element={<Export />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="ai-settings" element={<AISettings />} />
      </Route>

      {/* Moderator Portal Routes */}
      <Route
        path="/portal"
        element={
          <ModeratorProtectedRoute>
            <ModeratorLayout />
          </ModeratorProtectedRoute>
        }
      >
        <Route index element={<Schedule />} />
        <Route path="availability" element={<Settings />} />
      </Route>

      {/* Visitor Routes */}
      <Route path="/visitor/login" element={<VisitorLogin />} />
      <Route path="/visitor/register" element={<VisitorRegister />} />
      <Route
        path="/explore"
        element={
          <VisitorProtectedRoute>
            <Explore />
          </VisitorProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}

export default App
