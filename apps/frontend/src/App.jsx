import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Public pages
import Landing from './pages/Public/Landing'
import Register from './pages/Public/Register'
import Lookup from './pages/Public/Lookup'
import Availability from './pages/Public/Availability'

// Admin pages
import AdminLogin from './pages/Admin/Login'
import AdminLayout from './components/layout/AdminLayout'
import Dashboard from './pages/Admin/Dashboard'
import EventDays from './pages/Admin/EventDays'
import Rooms from './pages/Admin/Rooms'
import Sessions from './pages/Admin/Sessions'
import Moderators from './pages/Admin/Moderators'
import Assignments from './pages/Admin/Assignments'

// Moderator pages
import MyAssignments from './pages/Moderator/MyAssignments'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />
  }

  return children
}

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/register" element={<Register />} />
      <Route path="/lookup" element={<Lookup />} />
      <Route path="/availability/:moderatorId" element={<Availability />} />

      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="days" element={<EventDays />} />
        <Route path="rooms" element={<Rooms />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="moderators" element={<Moderators />} />
        <Route path="assignments" element={<Assignments />} />
      </Route>

      {/* Moderator Routes */}
      <Route path="/my/assignments/:moderatorId" element={<MyAssignments />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
