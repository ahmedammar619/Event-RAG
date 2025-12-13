import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { daysService, availabilityService, moderatorsService } from '../../services/api'
import { useToast } from '../../context/ToastContext'

export default function Availability() {
  const { moderatorId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [moderator, setModerator] = useState(null)
  const [days, setDays] = useState([])
  const [availability, setAvailability] = useState({})
  const [schedulePreference, setSchedulePreference] = useState('no_preference')

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

      const mod = modRes.data.data
      setModerator(mod)
      setSchedulePreference(mod.schedule_preference || 'no_preference')
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

      // Save availability and update schedule preference
      await Promise.all([
        availabilityService.bulkCreate(moderatorId, slots),
        moderatorsService.update(moderatorId, { schedule_preference: schedulePreference })
      ])

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
    <div className="min-h-screen p-4 md:p-8 pb-20 bg-slate-50">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link to="/" className="inline-block mb-4 text-slate-500 text-sm hover:text-slate-700">
            &larr; Back
          </Link>
          <h1 className="text-2xl font-semibold mb-2">Set Your Availability</h1>
          <p className="text-slate-500">Hello, <strong className="text-slate-800">{moderator?.name}</strong>! Select when you're available to volunteer.</p>
        </div>

        <div className="flex flex-col gap-4">
          {days.map(day => (
            <div key={day.id} className="card">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold mb-1">{formatDate(day.date)}</h3>
                  <p className="text-slate-500 text-sm">
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
                <p className="text-slate-500 text-sm">No availability set for this day</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {availability[day.id].map((slot, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-3">
                      <select
                        className="form-input w-auto min-w-[100px] flex-1 sm:flex-none"
                        value={slot.start_time}
                        onChange={e => updateSlot(day.id, index, 'start_time', e.target.value)}
                      >
                        {generateTimeOptions(day.start_time, day.end_time).map(time => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                      <span className="text-slate-500">to</span>
                      <select
                        className="form-input w-auto min-w-[100px] flex-1 sm:flex-none"
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
          <>
            {/* Schedule Preference */}
            <div className="card mt-6">
              <h3 className="text-lg font-semibold mb-2">Schedule Preference</h3>
              <p className="text-sm text-slate-500 mb-4">How would you prefer your sessions to be scheduled?</p>
              <div className="flex flex-col gap-2">
                <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all hover:border-blue-500 hover:bg-blue-50/50 ${schedulePreference === 'consecutive' ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                  <input
                    type="radio"
                    name="schedule_preference"
                    value="consecutive"
                    checked={schedulePreference === 'consecutive'}
                    onChange={e => setSchedulePreference(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">Back-to-back</span>
                    <span className="text-xs text-slate-500">I prefer sessions one after another</span>
                  </div>
                </label>
                <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all hover:border-blue-500 hover:bg-blue-50/50 ${schedulePreference === 'spread_out' ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                  <input
                    type="radio"
                    name="schedule_preference"
                    value="spread_out"
                    checked={schedulePreference === 'spread_out'}
                    onChange={e => setSchedulePreference(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">Spread out</span>
                    <span className="text-xs text-slate-500">I prefer breaks between sessions</span>
                  </div>
                </label>
                <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all hover:border-blue-500 hover:bg-blue-50/50 ${schedulePreference === 'no_preference' ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                  <input
                    type="radio"
                    name="schedule_preference"
                    value="no_preference"
                    checked={schedulePreference === 'no_preference'}
                    onChange={e => setSchedulePreference(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">No preference</span>
                    <span className="text-xs text-slate-500">I'm flexible with scheduling</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="mt-8">
              <button
                className="btn btn-primary btn-lg w-full"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Availability'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
