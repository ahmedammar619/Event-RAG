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

  const removeAssignment = async (assignmentId, moderatorName) => {
    if (!confirm(`Remove ${moderatorName} from this session?`)) {
      return
    }

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
      <div className="page-header flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1>Assignments</h1>
          <p>Manage moderator assignments to sessions</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button className="btn btn-outline w-full sm:w-auto" onClick={resetAssignments}>
            Clear All
          </button>
          <button className="btn btn-primary w-full sm:w-auto" onClick={() => setShowAutoModal(true)}>
            Auto-Assign
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-green-600">{stats.fullyAssigned}</div>
          <div className="stat-label">Fully Assigned</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-amber-600">{stats.partiallyAssigned}</div>
          <div className="stat-label">Partially Assigned</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-red-600">{stats.unassigned}</div>
          <div className="stat-label">Unassigned</div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="form-group mb-0">
          <label className="form-label">Filter by Day</label>
          <select
            className="form-input w-full sm:w-auto"
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

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : sessions.length === 0 ? (
        <div className="empty-state card">
          <h3>No sessions found</h3>
          <p>Add sessions before managing assignments</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sessions.map(session => (
            <div key={session.id} className="card p-4">
              <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-base font-semibold mb-1">{session.name}</h3>
                  <p className="text-sm text-slate-500">
                    {formatDate(session.date)} | {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}
                  </p>
                  {session.room_name && (
                    <p className="text-sm text-slate-500">{session.room_name}</p>
                  )}
                </div>
                <span className={`badge ${session.assigned_moderators.length >= session.moderators_needed ? 'badge-success' : session.assigned_moderators.length > 0 ? 'badge-warning' : 'badge-danger'}`}>
                  {session.assigned_moderators.length}/{session.moderators_needed}
                </span>
              </div>

              <div className="flex flex-col gap-2 mb-3">
                {session.assigned_moderators.length === 0 ? (
                  <p className="text-sm text-slate-500">No moderators assigned</p>
                ) : (
                  session.assigned_moderators.map(mod => (
                    <div key={mod.id} className="flex justify-between items-center p-2 bg-slate-50 rounded text-sm">
                      <span>{mod.name}</span>
                      <button
                        className="bg-transparent border-none text-red-500 text-xl cursor-pointer px-1 hover:text-red-700"
                        onClick={() => removeAssignment(mod.assignment_id, mod.name)}
                        title="Remove assignment"
                      >
                        &times;
                      </button>
                    </div>
                  ))
                )}
              </div>
              <button
                className="btn btn-outline btn-sm w-full"
                onClick={() => openManualModal(session)}
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
                <div className="bg-slate-50 rounded-lg p-4 mt-4 text-sm">
                  <h4 className="font-semibold mb-2">Last Result:</h4>
                  <p>Sessions assigned: {lastResult.sessions_assigned}/{lastResult.total_sessions}</p>
                  <p>Assignments created: {lastResult.total_assignments_created}</p>
                  {lastResult.unassigned_sessions?.length > 0 && (
                    <div>
                      <p className="text-amber-600 mt-2">Unassigned sessions:</p>
                      <ul className="mt-1 pl-5 list-disc">
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
                <span className="text-sm text-slate-500">
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
                <p className="text-amber-600 text-sm">All moderators are already assigned to this session.</p>
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
    </div>
  )
}
