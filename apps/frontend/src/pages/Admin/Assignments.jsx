import { useState, useEffect } from 'react'
import { assignmentsService, sessionsService, daysService, moderatorsService } from '../../services/api'
import { useToast } from '../../context/ToastContext'

export default function Assignments() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState([])
  const [days, setDays] = useState([])
  const [moderators, setModerators] = useState([])
  const [filter, setFilter] = useState({ day_id: '' })
  const [showAutoModal, setShowAutoModal] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedModerator, setSelectedModerator] = useState('')
  const [autoOptions, setAutoOptions] = useState({
    clear_existing: false,
    day_id: null
  })
  const [lastResult, setLastResult] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadSessions()
  }, [filter])

  const loadData = async () => {
    try {
      const [daysRes, modsRes] = await Promise.all([
        daysService.getAll(),
        moderatorsService.getAll()
      ])
      setDays(daysRes.data.data)
      setModerators(modsRes.data.data)
    } catch (err) {
      toast.error('Failed to load data')
    }
  }

  const loadSessions = async () => {
    setLoading(true)
    try {
      const response = await sessionsService.getAll(filter)
      setSessions(response.data.data)
    } catch (err) {
      toast.error('Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  const runAutoAssign = async () => {
    setRunning(true)
    try {
      const response = await assignmentsService.autoAssign(autoOptions)
      const result = response.data.data
      setLastResult(result)
      toast.success(`Assigned ${result.total_assignments_created} moderators to ${result.sessions_assigned} sessions`)
      setShowAutoModal(false)
      loadSessions()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Auto-assignment failed')
    } finally {
      setRunning(false)
    }
  }

  const removeAssignment = async (assignmentId) => {
    try {
      await assignmentsService.delete(assignmentId)
      toast.success('Assignment removed')
      loadSessions()
    } catch (err) {
      toast.error('Failed to remove assignment')
    }
  }

  const openManualModal = (session) => {
    setSelectedSession(session)
    setSelectedModerator('')
    setShowManualModal(true)
  }

  const handleManualAssign = async () => {
    if (!selectedModerator) {
      toast.error('Please select a moderator')
      return
    }

    try {
      const response = await assignmentsService.manualAssign(selectedSession.id, parseInt(selectedModerator))
      if (response.data.data.warning) {
        toast.warning(response.data.data.warning)
      }
      toast.success('Moderator assigned successfully')
      setShowManualModal(false)
      loadSessions()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to assign moderator')
    }
  }

  const getAvailableModerators = () => {
    if (!selectedSession) return []
    const assignedIds = selectedSession.assigned_moderators.map(m => m.id)
    return moderators.filter(m => !assignedIds.includes(m.id))
  }

  const resetAssignments = async () => {
    if (!confirm('Are you sure you want to clear all assignments?')) return

    try {
      await assignmentsService.reset(filter.day_id || null)
      toast.success('Assignments cleared')
      loadSessions()
    } catch (err) {
      toast.error('Failed to clear assignments')
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const dateOnly = dateStr.split('T')[0]
    const date = new Date(dateOnly + 'T00:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const getAssignmentStats = () => {
    const total = sessions.length
    const fullyAssigned = sessions.filter(s => s.assigned_moderators.length >= s.moderators_needed).length
    const partiallyAssigned = sessions.filter(s => s.assigned_moderators.length > 0 && s.assigned_moderators.length < s.moderators_needed).length
    const unassigned = sessions.filter(s => s.assigned_moderators.length === 0).length

    return { total, fullyAssigned, partiallyAssigned, unassigned }
  }

  const stats = getAssignmentStats()

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Assignments</h1>
          <p>Manage moderator assignments to sessions</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={resetAssignments}>
            Clear All
          </button>
          <button className="btn btn-primary" onClick={() => setShowAutoModal(true)}>
            Auto-Assign
          </button>
        </div>
      </div>

      <div className="grid grid-4 mb-4">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.fullyAssigned}</div>
          <div className="stat-label">Fully Assigned</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.partiallyAssigned}</div>
          <div className="stat-label">Partially Assigned</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.unassigned}</div>
          <div className="stat-label">Unassigned</div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="flex gap-4">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Filter by Day</label>
            <select
              className="form-input"
              value={filter.day_id}
              onChange={e => setFilter({ ...filter, day_id: e.target.value })}
            >
              <option value="">All Days</option>
              {days.map(day => (
                <option key={day.id} value={day.id}>{formatDate(day.date)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : sessions.length === 0 ? (
        <div className="empty-state card">
          <h3>No sessions found</h3>
          <p>Add sessions before managing assignments</p>
        </div>
      ) : (
        <div className="sessions-grid">
          {sessions.map(session => (
            <div key={session.id} className="session-card card">
              <div className="session-header">
                <div>
                  <h3>{session.name}</h3>
                  <p className="text-sm text-muted">
                    {formatDate(session.date)} | {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}
                  </p>
                  {session.room_name && (
                    <p className="text-sm text-muted">{session.room_name}</p>
                  )}
                </div>
                <span className={`badge ${session.assigned_moderators.length >= session.moderators_needed ? 'badge-success' : session.assigned_moderators.length > 0 ? 'badge-warning' : 'badge-danger'}`}>
                  {session.assigned_moderators.length}/{session.moderators_needed}
                </span>
              </div>

              <div className="assigned-list">
                {session.assigned_moderators.length === 0 ? (
                  <p className="text-sm text-muted">No moderators assigned</p>
                ) : (
                  session.assigned_moderators.map(mod => (
                    <div key={mod.id} className="assigned-item">
                      <span>{mod.name}</span>
                      <button
                        className="btn-remove"
                        onClick={() => removeAssignment(mod.assignment_id)}
                        title="Remove assignment"
                      >
                        &times;
                      </button>
                    </div>
                  ))
                )}
              </div>
              <button
                className="btn btn-outline btn-sm mt-3"
                onClick={() => openManualModal(session)}
                style={{ width: '100%' }}
              >
                + Assign Moderator
              </button>
            </div>
          ))}
        </div>
      )}

      {showAutoModal && (
        <div className="modal-overlay" onClick={() => setShowAutoModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Auto-Assign Moderators</h3>
              <button className="modal-close" onClick={() => setShowAutoModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="mb-4">
                The auto-assignment algorithm will match available moderators to sessions
                based on their availability and workload balance.
              </p>

              <div className="form-group">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoOptions.clear_existing}
                    onChange={e => setAutoOptions({ ...autoOptions, clear_existing: e.target.checked })}
                  />
                  Clear existing assignments first
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Assign for specific day (optional)</label>
                <select
                  className="form-input"
                  value={autoOptions.day_id || ''}
                  onChange={e => setAutoOptions({ ...autoOptions, day_id: e.target.value ? parseInt(e.target.value) : null })}
                >
                  <option value="">All Days</option>
                  {days.map(day => (
                    <option key={day.id} value={day.id}>{formatDate(day.date)}</option>
                  ))}
                </select>
              </div>

              {lastResult && (
                <div className="result-box">
                  <h4>Last Result:</h4>
                  <p>Sessions assigned: {lastResult.sessions_assigned}/{lastResult.total_sessions}</p>
                  <p>Assignments created: {lastResult.total_assignments_created}</p>
                  {lastResult.unassigned_sessions?.length > 0 && (
                    <div>
                      <p className="text-warning">Unassigned sessions:</p>
                      <ul>
                        {lastResult.unassigned_sessions.map((s, i) => (
                          <li key={i}>{s.name}: {s.reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAutoModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={runAutoAssign} disabled={running}>
                {running ? 'Running...' : 'Run Auto-Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showManualModal && selectedSession && (
        <div className="modal-overlay" onClick={() => setShowManualModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Assign Moderator</h3>
              <button className="modal-close" onClick={() => setShowManualModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="mb-4">
                <strong>Session:</strong> {selectedSession.name}<br />
                <span className="text-sm text-muted">
                  {formatDate(selectedSession.date)} | {selectedSession.start_time?.slice(0, 5)} - {selectedSession.end_time?.slice(0, 5)}
                </span>
              </p>

              <div className="form-group">
                <label className="form-label">Select Moderator</label>
                <select
                  className="form-input"
                  value={selectedModerator}
                  onChange={e => setSelectedModerator(e.target.value)}
                >
                  <option value="">Choose a moderator...</option>
                  {getAvailableModerators().map(mod => (
                    <option key={mod.id} value={mod.id}>
                      {mod.name} ({mod.email})
                    </option>
                  ))}
                </select>
              </div>

              {getAvailableModerators().length === 0 && (
                <p className="text-warning text-sm">All moderators are already assigned to this session.</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowManualModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleManualAssign}
                disabled={!selectedModerator}
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .sessions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1rem;
        }

        .session-card {
          padding: 1rem;
        }

        .session-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border);
        }

        .session-header h3 {
          font-size: 1rem;
          margin-bottom: 0.25rem;
        }

        .assigned-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .assigned-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          background: var(--bg);
          border-radius: 4px;
          font-size: 0.875rem;
        }

        .btn-remove {
          background: none;
          border: none;
          color: var(--danger);
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0 0.25rem;
        }

        .result-box {
          background: var(--bg);
          border-radius: var(--radius);
          padding: 1rem;
          margin-top: 1rem;
          font-size: 0.875rem;
        }

        .result-box h4 {
          margin-bottom: 0.5rem;
        }

        .result-box ul {
          margin-top: 0.5rem;
          padding-left: 1.25rem;
        }
      `}</style>
    </div>
  )
}
