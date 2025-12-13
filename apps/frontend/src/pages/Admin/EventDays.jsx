import { useState, useEffect } from 'react'
import { daysService } from '../../services/api'
import { useToast } from '../../context/ToastContext'

export default function EventDays() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingDay, setEditingDay] = useState(null)
  const [form, setForm] = useState({
    date: '',
    start_time: '09:00',
    end_time: '18:00'
  })

  useEffect(() => {
    loadDays()
  }, [])

  const loadDays = async () => {
    try {
      const response = await daysService.getAll()
      setDays(response.data.data)
    } catch (err) {
      toast.error('Failed to load event days')
    } finally {
      setLoading(false)
    }
  }

  const openModal = (day = null) => {
    if (day) {
      setEditingDay(day)
      setForm({
        date: day.date,
        start_time: day.start_time.slice(0, 5),
        end_time: day.end_time.slice(0, 5)
      })
    } else {
      setEditingDay(null)
      setForm({ date: '', start_time: '09:00', end_time: '18:00' })
    }
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingDay) {
        await daysService.update(editingDay.id, form)
        toast.success('Event day updated')
      } else {
        await daysService.create(form)
        toast.success('Event day created')
      }
      setShowModal(false)
      loadDays()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Operation failed')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure? This will delete all sessions for this day.')) return

    try {
      await daysService.delete(id)
      toast.success('Event day deleted')
      loadDays()
    } catch (err) {
      toast.error('Failed to delete event day')
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>
  }

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Event Days</h1>
          <p>Manage the days when the event takes place</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          + Add Day
        </button>
      </div>

      {days.length === 0 ? (
        <div className="empty-state card">
          <h3>No event days configured</h3>
          <p>Add event days to start setting up sessions</p>
          <button className="btn btn-primary mt-4" onClick={() => openModal()}>
            Add First Day
          </button>
        </div>
      ) : (
        <div className="table-container card">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Sessions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {days.map(day => (
                <tr key={day.id}>
                  <td><strong>{formatDate(day.date)}</strong></td>
                  <td>{day.start_time.slice(0, 5)}</td>
                  <td>{day.end_time.slice(0, 5)}</td>
                  <td>{day.session_count} sessions</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-outline btn-sm" onClick={() => openModal(day)}>
                        Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(day.id)}>
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingDay ? 'Edit Day' : 'Add Event Day'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    required
                  />
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
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingDay ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
