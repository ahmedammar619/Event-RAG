import { useState, useEffect } from 'react'
import { sessionsService, daysService, roomsService, speakersService } from '../../services/api'
import { useToast } from '../../context/ToastContext'

export default function Sessions() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState([])
  const [days, setDays] = useState([])
  const [rooms, setRooms] = useState([])
  const [speakers, setSpeakers] = useState([])
  const [filter, setFilter] = useState({ day_id: '', room_id: '' })
  const [showModal, setShowModal] = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const [form, setForm] = useState({
    name: '',
    event_day_id: '',
    room_id: '',
    start_time: '',
    end_time: '',
    moderators_needed: 1,
    speaker: ''
  })

  // Headcount editing state
  const [editingHeadcountId, setEditingHeadcountId] = useState(null)
  const [headcountValue, setHeadcountValue] = useState('')
  const [inputMode, setInputMode] = useState('percentage')
  const [savingHeadcount, setSavingHeadcount] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadSessions()
  }, [filter])

  const loadData = async () => {
    try {
      const [daysRes, roomsRes, speakersRes] = await Promise.all([
        daysService.getAll(),
        roomsService.getAll(),
        speakersService.getAll()
      ])
      setDays(daysRes.data.data)
      setRooms(roomsRes.data.data)
      setSpeakers(speakersRes.data.data || [])
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

  const openModal = (session = null) => {
    if (session) {
      setEditingSession(session)
      setForm({
        name: session.name,
        event_day_id: session.event_day_id,
        room_id: session.room_id || '',
        start_time: session.start_time.slice(0, 5),
        end_time: session.end_time.slice(0, 5),
        moderators_needed: session.moderators_needed,
        speaker: session.speaker || ''
      })
    } else {
      setEditingSession(null)
      setForm({
        name: '',
        event_day_id: days[0]?.id || '',
        room_id: '',
        start_time: '',
        end_time: '',
        moderators_needed: 1,
        speaker: ''
      })
    }
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = {
        ...form,
        event_day_id: parseInt(form.event_day_id),
        room_id: form.room_id ? parseInt(form.room_id) : null,
        moderators_needed: parseInt(form.moderators_needed),
        speaker: form.speaker || null
      }

      if (editingSession) {
        await sessionsService.update(editingSession.id, data)
        toast.success('Session updated')
      } else {
        await sessionsService.create(data)
        toast.success('Session created')
      }
      setShowModal(false)
      loadSessions()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Operation failed')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this session?')) return

    try {
      await sessionsService.delete(id)
      toast.success('Session deleted')
      loadSessions()
    } catch (err) {
      toast.error('Failed to delete session')
    }
  }

  // Headcount editing functions
  const startEditingHeadcount = (session) => {
    setEditingHeadcountId(session.id)
    if (session.headcount_percentage !== null && session.headcount_percentage !== undefined) {
      setInputMode('percentage')
      setHeadcountValue(session.headcount_percentage.toString())
    } else if (session.headcount !== null && session.headcount !== undefined && session.headcount > 0) {
      setInputMode('exact')
      setHeadcountValue(session.headcount.toString())
    } else {
      setInputMode('percentage')
      setHeadcountValue('')
    }
  }

  const saveHeadcount = async (sessionId) => {
    const value = parseInt(headcountValue)
    if (isNaN(value) || value < 0) {
      toast.error('Please enter a valid number')
      return
    }
    if (inputMode === 'percentage' && value > 100) {
      toast.error('Percentage cannot exceed 100')
      return
    }

    setSavingHeadcount(true)
    try {
      const data = inputMode === 'percentage'
        ? { headcount_percentage: value }
        : { headcount: value }

      await sessionsService.updateHeadcount(sessionId, data)
      toast.success('Headcount saved!')
      setEditingHeadcountId(null)
      loadSessions()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save headcount')
    } finally {
      setSavingHeadcount(false)
    }
  }

  const cancelEditingHeadcount = () => {
    setEditingHeadcountId(null)
    setHeadcountValue('')
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const dateOnly = dateStr.split('T')[0]
    const date = new Date(dateOnly + 'T00:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1>Sessions</h1>
          <p>Manage event sessions and talks</p>
        </div>
        <button className="btn btn-primary w-full sm:w-auto" onClick={() => openModal()} disabled={days.length === 0}>
          + Add Session
        </button>
      </div>

      {days.length === 0 ? (
        <div className="empty-state card">
          <h3>No event days configured</h3>
          <p>Please add event days before creating sessions</p>
        </div>
      ) : (
        <>
          <div className="card mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-group mb-0">
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
              <div className="form-group mb-0">
                <label className="form-label">Filter by Room</label>
                <select
                  className="form-input"
                  value={filter.room_id}
                  onChange={e => setFilter({ ...filter, room_id: e.target.value })}
                >
                  <option value="">All Rooms</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>{room.name}</option>
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
              <p>Add sessions to start scheduling moderators</p>
            </div>
          ) : (
            <div className="card table-card">
              <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Speaker</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Room</th>
                    <th>Headcount</th>
                    <th>Moderators</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(session => {
                    const getHeadcountDisplay = () => {
                      if (session.headcount_percentage !== null && session.headcount_percentage !== undefined) {
                        const estimated = session.room_capacity
                          ? Math.round((session.headcount_percentage / 100) * session.room_capacity)
                          : null
                        return (
                          <span className="text-blue-600" title="Estimate based on percentage">
                            ~{estimated !== null ? estimated : '?'}
                            <span className="text-xs ml-1">({session.headcount_percentage}%)</span>
                          </span>
                        )
                      } else if (session.headcount !== null && session.headcount !== undefined && session.headcount > 0) {
                        return <span>{session.headcount}</span>
                      }
                      return <span className="text-slate-400">-</span>
                    }

                    return (
                      <tr key={session.id}>
                        <td><strong>{session.name}</strong></td>
                        <td className="text-sm text-slate-600">{session.speaker || <span className="text-slate-400">-</span>}</td>
                        <td>{formatDate(session.date)}</td>
                        <td>{session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}</td>
                        <td>{session.room_name || '-'}</td>
                        <td>
                          {editingHeadcountId === session.id ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => setInputMode('percentage')}
                                  className={`px-2 py-1 text-xs rounded ${inputMode === 'percentage' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                                >
                                  % Full
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInputMode('exact')}
                                  className={`px-2 py-1 text-xs rounded ${inputMode === 'exact' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                                >
                                  Exact #
                                </button>
                              </div>
                              <div className="flex gap-1 items-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={inputMode === 'percentage' ? 100 : undefined}
                                  value={headcountValue}
                                  onChange={(e) => setHeadcountValue(e.target.value)}
                                  className="form-input w-20 py-1 text-sm"
                                  placeholder={inputMode === 'percentage' ? '0-100' : 'Count'}
                                />
                                {inputMode === 'percentage' && <span className="text-xs text-slate-500">%</span>}
                              </div>
                              {inputMode === 'percentage' && headcountValue && session.room_capacity && (
                                <div className="text-xs text-slate-500">
                                  ~{Math.round((parseInt(headcountValue) / 100) * session.room_capacity)} people
                                </div>
                              )}
                              <div className="flex gap-1">
                                <button
                                  onClick={() => saveHeadcount(session.id)}
                                  disabled={savingHeadcount}
                                  className="btn btn-primary btn-sm py-1 px-2 text-xs"
                                >
                                  {savingHeadcount ? '...' : 'Save'}
                                </button>
                                <button
                                  onClick={cancelEditingHeadcount}
                                  className="btn btn-outline btn-sm py-1 px-2 text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditingHeadcount(session)}
                              className="flex items-center gap-1.5 cursor-pointer hover:bg-blue-50 border border-dashed border-slate-300 hover:border-blue-400 rounded px-2 py-1 transition-colors group"
                              title="Click to edit headcount"
                            >
                              {getHeadcountDisplay()}
                              <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${session.assigned_moderators.length >= session.moderators_needed ? 'badge-success' : 'badge-warning'}`}>
                            {session.assigned_moderators.length}/{session.moderators_needed}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button className="btn btn-outline btn-sm" onClick={() => openModal(session)}>
                              Edit
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(session.id)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingSession ? 'Edit Session' : 'Add Session'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Session Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Opening Keynote"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Event Day</label>
                    <select
                      className="form-input"
                      value={form.event_day_id}
                      onChange={e => setForm({ ...form, event_day_id: e.target.value })}
                      required
                    >
                      <option value="">Select Day</option>
                      {days.map(day => (
                        <option key={day.id} value={day.id}>{formatDate(day.date)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Room</label>
                    <select
                      className="form-input"
                      value={form.room_id}
                      onChange={e => setForm({ ...form, room_id: e.target.value })}
                    >
                      <option value="">No Room</option>
                      {rooms.map(room => (
                        <option key={room.id} value={room.id}>{room.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Time</label>
                    <input
                      type="time"
                      className="form-input"
                      value={form.start_time}
                      onChange={e => setForm({ ...form, start_time: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Time</label>
                    <input
                      type="time"
                      className="form-input"
                      value={form.end_time}
                      onChange={e => setForm({ ...form, end_time: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Moderators Needed</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    value={form.moderators_needed}
                    onChange={e => setForm({ ...form, moderators_needed: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Speaker (optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    list="speakers-list"
                    placeholder="Select or type speaker name"
                    value={form.speaker}
                    onChange={e => setForm({ ...form, speaker: e.target.value })}
                  />
                  <datalist id="speakers-list">
                    {speakers.map(speaker => (
                      <option key={speaker.id} value={speaker.name} />
                    ))}
                  </datalist>
                  <p className="text-xs text-slate-500 mt-1">
                    Select from existing speakers or type a new name
                  </p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingSession ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
