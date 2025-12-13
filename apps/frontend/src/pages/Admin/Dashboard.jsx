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
    <div className="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of the MASCOM 2025 moderation system</p>
      </div>

      <div className="grid grid-4 mb-4">
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
          <div className="stat-value" style={{ color: stats?.unassignedSessions > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {stats?.unassignedSessions || 0}
          </div>
          <div className="stat-label">Unassigned Sessions</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Quick Actions</h3>
          </div>
          <div className="quick-actions">
            <Link to="/admin/days" className="quick-action">
              <span className="quick-action-icon">📅</span>
              <span>Manage Event Days</span>
            </Link>
            <Link to="/admin/sessions" className="quick-action">
              <span className="quick-action-icon">🎤</span>
              <span>Manage Sessions</span>
            </Link>
            <Link to="/admin/assignments" className="quick-action">
              <span className="quick-action-icon">👥</span>
              <span>Auto-Assign Moderators</span>
            </Link>
            <Link to="/admin/moderators" className="quick-action">
              <span className="quick-action-icon">📋</span>
              <span>View All Moderators</span>
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Registration Link</h3>
          </div>
          <p className="text-sm text-muted mb-4">
            Share this link with volunteers to let them register and input their availability.
          </p>
          <div className="link-box">
            <input
              type="text"
              className="form-input"
              value={registrationLink}
              readOnly
            />
            <button
              className="btn btn-primary"
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

      <style>{`
        .quick-actions {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }

        .quick-action {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: var(--bg);
          border-radius: var(--radius);
          text-decoration: none;
          color: var(--text);
          transition: all 0.15s ease;
        }

        .quick-action:hover {
          background: #e2e8f0;
          text-decoration: none;
        }

        .quick-action-icon {
          font-size: 1.5rem;
        }

        .link-box {
          display: flex;
          gap: 0.5rem;
        }

        .link-box input {
          flex: 1;
        }
      `}</style>
    </div>
  )
}
