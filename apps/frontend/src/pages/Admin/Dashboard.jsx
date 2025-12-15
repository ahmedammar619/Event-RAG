import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { adminService } from '../../services/api'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const response = await adminService.getDashboard()
      setStats(response.data.data)
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>
  }

  const registrationLink = `${window.location.origin}/register`

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of the MASCON 2025 moderation system</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-value">{stats?.totalModerators || 0}</div>
          <div className="stat-label">Registered Moderators</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.totalSessions || 0}</div>
          <div className="stat-label">Total Sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.assignedSessions || 0}</div>
          <div className="stat-label">Assigned Sessions</div>
        </div>
        <div className="stat-card">
          <div className={`stat-value ${stats?.unassignedSessions > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {stats?.unassignedSessions || 0}
          </div>
          <div className="stat-label">Unassigned Sessions</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link to="/admin/days" className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg no-underline text-slate-800 hover:bg-slate-100 transition-colors">
              <span className="text-2xl">📅</span>
              <span className="text-sm sm:text-base">Event Days</span>
            </Link>
            <Link to="/admin/sessions" className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg no-underline text-slate-800 hover:bg-slate-100 transition-colors">
              <span className="text-2xl">🎤</span>
              <span className="text-sm sm:text-base">Sessions</span>
            </Link>
            <Link to="/admin/assignments" className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg no-underline text-slate-800 hover:bg-slate-100 transition-colors">
              <span className="text-2xl">👥</span>
              <span className="text-sm sm:text-base">Auto-Assign</span>
            </Link>
            <Link to="/admin/moderators" className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg no-underline text-slate-800 hover:bg-slate-100 transition-colors">
              <span className="text-2xl">📋</span>
              <span className="text-sm sm:text-base">Moderators</span>
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Registration Link</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Share this link with moderators to let them register and input their availability.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              className="form-input flex-1 text-sm"
              value={registrationLink}
              readOnly
            />
            <button
              className="btn btn-primary w-full sm:w-auto"
              onClick={() => {
                navigator.clipboard.writeText(registrationLink)
                alert('Link copied to clipboard!')
              }}
            >
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
