import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { daysService, availabilityService, moderatorsService } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import Footer from '../../components/common/Footer'

export default function Availability() {
  const { moderatorId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [moderator, setModerator] = useState(null)
  const [days, setDays] = useState([])
  const [availability, setAvailability] = useState({})

  useEffect(() => {
    loadData()
  }, [moderatorId])

  const loadData = async () => {
    try {
      const [modRes, daysRes, availRes] = await Promise.all([
        moderatorsService.getById(moderatorId),
        daysService.getAll(),
        availabilityService.getByModerator(moderatorId)
      ])

      setModerator(modRes.data.data)
      setDays(daysRes.data.data)

      // Group existing availability by day
      const grouped = {}
      availRes.data.data.forEach(slot => {
        if (!grouped[slot.event_day_id]) {
          grouped[slot.event_day_id] = []
        }
        grouped[slot.event_day_id].push({
          start_time: slot.start_time.slice(0, 5),
          end_time: slot.end_time.slice(0, 5)
        })
      })
      setAvailability(grouped)
    } catch (err) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const addSlot = (dayId) => {
    const day = days.find(d => d.id === dayId)
    setAvailability(prev => ({
      ...prev,
      [dayId]: [
        ...(prev[dayId] || []),
        { start_time: day.start_time.slice(0, 5), end_time: day.end_time.slice(0, 5) }
      ]
    }))
  }

  const removeSlot = (dayId, index) => {
    setAvailability(prev => ({
      ...prev,
      [dayId]: prev[dayId].filter((_, i) => i !== index)
    }))
  }

  const updateSlot = (dayId, index, field, value) => {
    setAvailability(prev => ({
      ...prev,
      [dayId]: prev[dayId].map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot
      )
    }))
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      // Flatten availability into slots array
      const slots = []
      Object.entries(availability).forEach(([dayId, daySlots]) => {
        daySlots.forEach(slot => {
          slots.push({
            event_day_id: parseInt(dayId),
            start_time: slot.start_time,
            end_time: slot.end_time
          })
        })
      })

      await availabilityService.bulkCreate(moderatorId, slots)
      toast.success('Availability saved successfully!')

      // Navigate to assignments page
      navigate(`/my/assignments/${moderatorId}`)
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Failed to save availability'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateStr) => {
    const dateOnly = dateStr.split('T')[0]
    const date = new Date(dateOnly + 'T00:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const generateTimeOptions = (dayStart, dayEnd) => {
    const options = []
    const [startHour] = dayStart.split(':').map(Number)
    const [endHour] = dayEnd.split(':').map(Number)

    for (let h = startHour; h <= endHour; h++) {
      for (let m = 0; m < 60; m += 30) {
        if (h === endHour && m > 0) break
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
        options.push(time)
      }
    }
    return options
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>
  }

  return (
    <div className="availability-page">
      <div className="availability-container">
        <div className="availability-header">
          <Link to="/" className="back-link">&larr; Back</Link>
          <h1>Set Your Availability</h1>
          <p>Hello, <strong>{moderator?.name}</strong>! Select when you're available to volunteer.</p>
        </div>

        <div className="days-list">
          {days.map(day => (
            <div key={day.id} className="day-card card">
              <div className="day-header">
                <div>
                  <h3>{formatDate(day.date)}</h3>
                  <p className="text-muted text-sm">
                    Event hours: {day.start_time.slice(0, 5)} - {day.end_time.slice(0, 5)}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => addSlot(day.id)}
                >
                  + Add Time Slot
                </button>
              </div>

              {(availability[day.id] || []).length === 0 ? (
                <p className="text-muted text-sm">No availability set for this day</p>
              ) : (
                <div className="slots-list">
                  {availability[day.id].map((slot, index) => (
                    <div key={index} className="slot-row">
                      <select
                        className="form-input"
                        value={slot.start_time}
                        onChange={e => updateSlot(day.id, index, 'start_time', e.target.value)}
                      >
                        {generateTimeOptions(day.start_time, day.end_time).map(time => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                      <span>to</span>
                      <select
                        className="form-input"
                        value={slot.end_time}
                        onChange={e => updateSlot(day.id, index, 'end_time', e.target.value)}
                      >
                        {generateTimeOptions(day.start_time, day.end_time).map(time => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => removeSlot(day.id, index)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {days.length === 0 && (
          <div className="empty-state">
            <h3>No event days available</h3>
            <p>Please check back later when event days have been configured.</p>
          </div>
        )}

        {days.length > 0 && (
          <div className="availability-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={handleSubmit}
              disabled={saving}
              style={{ width: '100%' }}
            >
              {saving ? 'Saving...' : 'Save Availability'}
            </button>
          </div>
        )}
      </div>
      <Footer />

      <style>{`
        .availability-page {
          min-height: 100vh;
          padding: 2rem;
          padding-bottom: 5rem;
          background: var(--bg);
        }

        .availability-container {
          max-width: 700px;
          margin: 0 auto;
        }

        .availability-header {
          margin-bottom: 2rem;
        }

        .back-link {
          display: inline-block;
          margin-bottom: 1rem;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .availability-header h1 {
          font-size: 1.75rem;
          margin-bottom: 0.5rem;
        }

        .day-card {
          margin-bottom: 1rem;
        }

        .day-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .day-header h3 {
          font-size: 1.125rem;
          margin-bottom: 0.25rem;
        }

        .slots-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .slot-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .slot-row select {
          width: auto;
        }

        .availability-actions {
          margin-top: 2rem;
        }

        @media (max-width: 640px) {
          .slot-row {
            flex-wrap: wrap;
          }

          .slot-row select {
            flex: 1;
            min-width: 100px;
          }
        }
      `}</style>
    </div>
  )
}
