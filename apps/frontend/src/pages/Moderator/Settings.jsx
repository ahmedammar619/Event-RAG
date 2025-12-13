import { useState, useEffect } from 'react'
import { daysService, availabilityService, moderatorsService } from '../../services/api'
import { useModerator } from '../../context/ModeratorContext'
import { useToast } from '../../context/ToastContext'

export default function Settings() {
  const { moderator, refresh } = useModerator()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [days, setDays] = useState([])
  const [availability, setAvailability] = useState({})
  const [schedulePreference, setSchedulePreference] = useState('no_preference')
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (moderator?.id) {
      loadData()
    }
  }, [moderator?.id])

  const loadData = async () => {
    try {
      const [daysRes, availRes] = await Promise.all([
        daysService.getAll(),
        availabilityService.getByModerator(moderator.id)
      ])

      setSchedulePreference(moderator.schedule_preference || 'no_preference')
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
      setHasChanges(false)
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
    setHasChanges(true)
  }

  const removeSlot = (dayId, index) => {
    setAvailability(prev => ({
      ...prev,
      [dayId]: prev[dayId].filter((_, i) => i !== index)
    }))
    setHasChanges(true)
  }

  const updateSlot = (dayId, index, field, value) => {
    setAvailability(prev => ({
      ...prev,
      [dayId]: prev[dayId].map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot
      )
    }))
    setHasChanges(true)
  }

  const handlePreferenceChange = (value) => {
    setSchedulePreference(value)
    setHasChanges(true)
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
        availabilityService.bulkCreate(moderator.id, slots),
        moderatorsService.update(moderator.id, { schedule_preference: schedulePreference })
      ])

      await refresh()
      setHasChanges(false)
      toast.success('Availability saved successfully!')
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-semibold mb-2">Availability Settings</h1>
        <p className="text-slate-500 text-sm md:text-base">
          Set when you're available to volunteer for sessions.
        </p>
      </div>

      <div className="flex flex-col gap-4 md:gap-6">
        {days.map(day => (
          <div key={day.id} className="card p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
              <div>
                <h3 className="text-base md:text-lg font-semibold mb-1">{formatDate(day.date)}</h3>
                <p className="text-slate-500 text-xs md:text-sm">
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
                  <div key={index} className="flex flex-wrap items-center gap-2 md:gap-3 p-3 bg-slate-50 rounded-lg">
                    <select
                      className="form-input w-full sm:w-auto min-w-[100px] text-sm py-2"
                      value={slot.start_time}
                      onChange={e => updateSlot(day.id, index, 'start_time', e.target.value)}
                    >
                      {generateTimeOptions(day.start_time, day.end_time).map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                    <span className="text-slate-500 hidden sm:inline">to</span>
                    <span className="text-slate-500 sm:hidden w-full text-center text-xs">to</span>
                    <select
                      className="form-input w-full sm:w-auto min-w-[100px] text-sm py-2"
                      value={slot.end_time}
                      onChange={e => updateSlot(day.id, index, 'end_time', e.target.value)}
                    >
                      {generateTimeOptions(day.start_time, day.end_time).map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm w-full sm:w-auto"
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
        <div className="card p-8 text-center">
          <div className="text-4xl mb-4">📅</div>
          <h3 className="text-lg font-semibold mb-2">No Event Days</h3>
          <p className="text-slate-500">
            Event days haven't been configured yet. Please check back later.
          </p>
        </div>
      )}

      {days.length > 0 && (
        <>
          {/* Schedule Preference */}
          <div className="card p-4 md:p-6 mt-4 md:mt-6">
            <h3 className="text-base md:text-lg font-semibold mb-2">Schedule Preference</h3>
            <p className="text-xs md:text-sm text-slate-500 mb-4">How would you prefer your sessions to be scheduled?</p>
            <div className="flex flex-col gap-2 md:gap-3">
              <label className={`flex items-start gap-3 p-3 md:p-4 border rounded-lg cursor-pointer transition-all hover:border-emerald-500 hover:bg-emerald-50/50 ${schedulePreference === 'consecutive' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                <input
                  type="radio"
                  name="schedule_preference"
                  value="consecutive"
                  checked={schedulePreference === 'consecutive'}
                  onChange={e => handlePreferenceChange(e.target.value)}
                  className="mt-0.5"
                />
                <div className="flex flex-col">
                  <span className="font-medium text-sm md:text-base">Back-to-back</span>
                  <span className="text-xs text-slate-500">I prefer sessions one after another</span>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-3 md:p-4 border rounded-lg cursor-pointer transition-all hover:border-emerald-500 hover:bg-emerald-50/50 ${schedulePreference === 'spread_out' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                <input
                  type="radio"
                  name="schedule_preference"
                  value="spread_out"
                  checked={schedulePreference === 'spread_out'}
                  onChange={e => handlePreferenceChange(e.target.value)}
                  className="mt-0.5"
                />
                <div className="flex flex-col">
                  <span className="font-medium text-sm md:text-base">Spread out</span>
                  <span className="text-xs text-slate-500">I prefer breaks between sessions</span>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-3 md:p-4 border rounded-lg cursor-pointer transition-all hover:border-emerald-500 hover:bg-emerald-50/50 ${schedulePreference === 'no_preference' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                <input
                  type="radio"
                  name="schedule_preference"
                  value="no_preference"
                  checked={schedulePreference === 'no_preference'}
                  onChange={e => handlePreferenceChange(e.target.value)}
                  className="mt-0.5"
                />
                <div className="flex flex-col">
                  <span className="font-medium text-sm md:text-base">No preference</span>
                  <span className="text-xs text-slate-500">I'm flexible with scheduling</span>
                </div>
              </label>
            </div>
          </div>

          {/* Save Button - Always visible */}
          <div className="sticky bottom-0 mt-6 md:mt-8 py-4 bg-slate-50">
            <button
              className={`btn btn-lg w-full ${hasChanges ? 'btn-primary' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
              onClick={handleSubmit}
              disabled={saving || !hasChanges}
            >
              {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
            </button>
            {hasChanges && (
              <p className="text-xs text-center text-emerald-600 mt-2">
                You have unsaved changes
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
