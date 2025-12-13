import { useState, useEffect } from 'react'
import { sessionsService, daysService, roomsService } from '../../services/api'
import { useToast } from '../../context/ToastContext'

export default function Sessions() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState([])
  const [days, setDays] = useState([])
  const [rooms, setRooms] = useState([])
  const [filter, setFilter] = useState({ day_id: '', room_id: '' })
  const [showModal, setShowModal] = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const [form, setForm] = useState({
    name: '',
    event_day_id: '',
    room_id: '',
    start_time: '',
    end_time: '',
    moderators_needed: 1
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadSessions()
  }, [filter])

  const loadData = async () => {
    try {
      const [daysRes, roomsRes] = await Promise.all([
        daysService.getAll(),
        roomsService.getAll()
      ])
      setDays(daysRes.data.data)
      setRooms(roomsRes.data.data)
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
        moderators_needed: session.moderators_needed
      })
    } else {
      setEditingSession(null)
      setForm({
        name: '',
        event_day_id: days[0]?.id || '',
        room_id: '',
        start_time: '',
        end_time: '',
        moderators_needed: 1
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
        moderators_needed: parseInt(form.moderators_needed)
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

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Sessions</h1>
          <p>Manage event sessions and talks</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()} disabled={days.length === 0}>
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
              <div className="form-group" style={{ marginBottom: 0 }}>
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
            <div className="table-container card">
              <table className="table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Room</th>
                    <th>Moderators</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(session => (
                    <tr key={session.id}>
                      <td><strong>{session.name}</strong></td>
                      <td>{formatDate(session.date)}</td>
                      <td>{session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}</td>
                      <td>{session.room_name || '-'}</td>
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
                  ))}
                </tbody>
              </table>
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
