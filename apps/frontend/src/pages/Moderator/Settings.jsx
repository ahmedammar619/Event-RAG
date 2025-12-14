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

      const grouped = {}
      availRes.data.data.forEach(slot => {
        if (!grouped[slot.event_day_id]) {
          grouped[slot.event_day_id] = []
        }
        grouped[slot.event_day_id].push({
          id: slot.id,
          start_time: slot.start_time.slice(0, 5),
          end_time: slot.end_time.slice(0, 5),
          modified: false
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
        { start_time: day.start_time.slice(0, 5), end_time: day.end_time.slice(0, 5), modified: true }
      ]
    }))
    setHasChanges(true)
  }

  const removeSlot = async (dayId, index) => {
    if (!confirm('Are you sure you want to remove this time slot?')) return

    const slot = availability[dayId][index]

    // If slot has an ID, it exists in database - delete it immediately
    if (slot.id) {
      try {
        await availabilityService.delete(slot.id)
        toast.success('Time slot removed')
      } catch (err) {
        toast.error('Failed to remove time slot')
        return
      }
    }

    setAvailability(prev => ({
      ...prev,
      [dayId]: prev[dayId].filter((_, i) => i !== index)
    }))
  }

  const updateSlot = (dayId, index, field, value) => {
    setAvailability(prev => ({
      ...prev,
      [dayId]: prev[dayId].map((slot, i) =>
        i === index ? { ...slot, [field]: value, modified: true } : slot
      )
    }))
    setHasChanges(true)
  }

  const setFullDay = (dayId) => {
    const day = days.find(d => d.id === dayId)
    setAvailability(prev => ({
      ...prev,
      [dayId]: [{ start_time: day.start_time.slice(0, 5), end_time: day.end_time.slice(0, 5), modified: true }]
    }))
    setHasChanges(true)
  }

  const clearDay = async (dayId) => {
    if (!confirm('Are you sure you want to clear all time slots for this day?')) return

    const daySlots = availability[dayId] || []
    const existingSlots = daySlots.filter(slot => slot.id)

    // Delete all existing slots from database
    if (existingSlots.length > 0) {
      try {
        await Promise.all(existingSlots.map(slot => availabilityService.delete(slot.id)))
        toast.success('Time slots cleared')
      } catch (err) {
        toast.error('Failed to clear time slots')
        return
      }
    }

    setAvailability(prev => ({
      ...prev,
      [dayId]: []
    }))
  }

  const handlePreferenceChange = (value) => {
    setSchedulePreference(value)
    setHasChanges(true)
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
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

      await Promise.all([
        availabilityService.bulkCreate(moderator.id, slots),
        moderatorsService.update(moderator.id, { schedule_preference: schedulePreference })
      ])

      await refresh()
      await loadData()
      toast.success('Availability saved!')
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateStr) => {
    const dateOnly = dateStr.split('T')[0]
    const date = new Date(dateOnly + 'T00:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime12 = (time24) => {
    const [hours, minutes] = time24.split(':')
    const h = parseInt(hours)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  const generateTimeOptions = (dayStart, dayEnd) => {
    const options = []
    const [startHour] = dayStart.split(':').map(Number)
    const [endHour] = dayEnd.split(':').map(Number)

    for (let h = startHour; h <= endHour; h++) {
      for (let m = 0; m < 60; m += 30) {
        if (h === endHour && m > 0) break
        const time24 = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
        options.push({ value: time24, label: formatTime12(time24) })
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

  const totalSlots = Object.values(availability).reduce((sum, slots) => sum + slots.length, 0)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">My Availability</h1>
        <p className="text-slate-500">Select the times you can volunteer each day</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-emerald-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{totalSlots}</div>
          <div className="text-sm text-emerald-700">Time Slots</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{days.length}</div>
          <div className="text-sm text-blue-700">Event Days</div>
        </div>
      </div>

      {days.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-slate-200">
          <div className="text-4xl mb-4">📅</div>
          <h3 className="text-lg font-semibold mb-2">No Event Days Yet</h3>
          <p className="text-slate-500">Check back later when event days are configured.</p>
        </div>
      ) : (
        <>
          {/* Event Days */}
          <div className="space-y-4 mb-6">
            {days.map(day => {
              const daySlots = availability[day.id] || []
              const hasSlots = daySlots.length > 0

              return (
                <div key={day.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  {/* Day Header */}
                  <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-white">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold">{formatDate(day.date)}</h3>
                        <p className="text-emerald-100 text-sm">
                          {formatTime12(day.start_time.slice(0, 5))} - {formatTime12(day.end_time.slice(0, 5))}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setFullDay(day.id)}
                          className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                        >
                          All Day
                        </button>
                        {hasSlots && (
                          <button
                            onClick={() => clearDay(day.id)}
                            className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Time Slots */}
                  <div className="p-4">
                    {!hasSlots ? (
                      <div className="text-center py-6">
                        <p className="text-slate-400 mb-3">No availability set</p>
                        <button
                          onClick={() => addSlot(day.id)}
                          className="btn btn-outline btn-sm"
                        >
                          + Add Time Slot
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {daySlots.map((slot, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                            <div className="flex-1 flex items-center gap-2 flex-wrap">
                              <select
                                className="flex-1 min-w-[120px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                value={slot.start_time}
                                onChange={e => updateSlot(day.id, index, 'start_time', e.target.value)}
                              >
                                {generateTimeOptions(day.start_time, day.end_time).map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                              <span className="text-slate-400 font-medium">to</span>
                              <select
                                className="flex-1 min-w-[120px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                value={slot.end_time}
                                onChange={e => updateSlot(day.id, index, 'end_time', e.target.value)}
                              >
                                {generateTimeOptions(day.start_time, day.end_time).map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                            <button
                              onClick={() => removeSlot(day.id, index)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove slot"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                            {slot.modified && (
                              <button
                                onClick={handleSubmit}
                                disabled={saving}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Save changes"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => addSlot(day.id)}
                          className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-emerald-500 hover:text-emerald-600 transition-colors text-sm font-medium"
                        >
                          + Add Another Slot
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Schedule Preference */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
            <h3 className="font-semibold text-slate-900 mb-1">Schedule Preference</h3>
            <p className="text-sm text-slate-500 mb-4">How should we schedule your sessions?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { value: 'consecutive', label: 'Back-to-back', icon: '⏩', desc: 'Sessions together' },
                { value: 'spread_out', label: 'Spread out', icon: '📊', desc: 'Breaks between' },
                { value: 'no_preference', label: 'Flexible', icon: '🔄', desc: 'Any schedule' }
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handlePreferenceChange(opt.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    schedulePreference === opt.value
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{opt.icon}</div>
                  <div className="font-medium text-slate-900">{opt.label}</div>
                  <div className="text-xs text-slate-500">{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* Save Button - Only shows when there are changes */}
            {hasChanges && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

    </div>
  )
}
