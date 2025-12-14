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
    if (!confirm('Remove this time slot?')) return

    const slot = availability[dayId][index]

    if (slot.id) {
      try {
        await availabilityService.delete(slot.id)
        toast.success('Removed')
      } catch (err) {
        toast.error('Failed to remove')
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
    if (!confirm('Clear all slots for this day?')) return

    const daySlots = availability[dayId] || []
    const existingSlots = daySlots.filter(slot => slot.id)

    if (existingSlots.length > 0) {
      try {
        await Promise.all(existingSlots.map(slot => availabilityService.delete(slot.id)))
        toast.success('Cleared')
      } catch (err) {
        toast.error('Failed to clear')
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
      toast.success('Saved!')
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
      weekday: 'short',
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
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="spinner"></div>
      </div>
    )
  }

  const totalSlots = Object.values(availability).reduce((sum, slots) => sum + slots.length, 0)

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">My Availability</h1>
        <p className="text-sm text-slate-500 mt-1">
          {totalSlots} time slot{totalSlots !== 1 ? 's' : ''} across {days.length} day{days.length !== 1 ? 's' : ''}
        </p>
      </div>

      {days.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-200">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Event Days</h3>
          <p className="text-slate-500 text-sm">Check back when event days are configured.</p>
        </div>
      ) : (
        <>
          {/* Days */}
          <div className="space-y-4 mb-6">
            {days.map(day => {
              const daySlots = availability[day.id] || []
              const hasSlots = daySlots.length > 0

              return (
                <div key={day.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  {/* Day Header */}
                  <div className="bg-emerald-600 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white">{formatDate(day.date)}</div>
                        <div className="text-emerald-100 text-xs mt-0.5">
                          {formatTime12(day.start_time.slice(0, 5))} - {formatTime12(day.end_time.slice(0, 5))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setFullDay(day.id)}
                          className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium text-white transition-colors"
                        >
                          All Day
                        </button>
                        {hasSlots && (
                          <button
                            onClick={() => clearDay(day.id)}
                            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium text-white transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Slots */}
                  <div className="p-4">
                    {!hasSlots ? (
                      <button
                        onClick={() => addSlot(day.id)}
                        className="w-full py-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-emerald-400 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Time Slot
                      </button>
                    ) : (
                      <div className="space-y-3">
                        {daySlots.map((slot, index) => (
                          <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                            <div className="flex-1 grid grid-cols-2 gap-2">
                              <select
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                value={slot.start_time}
                                onChange={e => updateSlot(day.id, index, 'start_time', e.target.value)}
                              >
                                {generateTimeOptions(day.start_time, day.end_time).map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                              <select
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addSlot(day.id)}
                          className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-emerald-400 hover:text-emerald-600 transition-colors text-sm font-medium"
                        >
                          + Add Another
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
            <p className="text-xs text-slate-500 mb-4">How should we schedule your sessions?</p>

            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'consecutive', label: 'Back-to-back', desc: 'Together' },
                { value: 'spread_out', label: 'Spread out', desc: 'Breaks' },
                { value: 'no_preference', label: 'Flexible', desc: 'Any' }
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handlePreferenceChange(opt.value)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    schedulePreference === opt.value
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`text-sm font-semibold ${schedulePreference === opt.value ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {opt.label}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          {hasChanges && (
            <div className="sticky bottom-4">
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
