import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { assignmentsService, sessionsService } from '../../services/api'
import { useModerator } from '../../context/ModeratorContext'
import { useToast } from '../../context/ToastContext'

export default function Schedule() {
  const { moderator } = useModerator()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [headcountValue, setHeadcountValue] = useState('')
  const [inputMode, setInputMode] = useState('percentage')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (moderator?.id) {
      loadData()
    }
  }, [moderator?.id])

  const loadData = async () => {
    try {
      const response = await assignmentsService.getByModerator(moderator.id)
      setAssignments(response.data.data)
    } catch (err) {
      toast.error('Failed to load assignments')
    } finally {
      setLoading(false)
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

    setSaving(true)
    try {
      const data = inputMode === 'percentage'
        ? { headcount_percentage: value }
        : { headcount: value }

      await sessionsService.updateHeadcount(sessionId, data)
      toast.success('Saved!')
      setEditingId(null)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const startEditing = (a) => {
    setEditingId(a.session_id)
    if (a.headcount_percentage) {
      setInputMode('percentage')
      setHeadcountValue(a.headcount_percentage.toString())
    } else if (a.headcount) {
      setInputMode('exact')
      setHeadcountValue(a.headcount.toString())
    } else {
      setInputMode('percentage')
      setHeadcountValue('')
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const dateOnly = dateStr.split('T')[0]
    const date = new Date(dateOnly + 'T00:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (time) => {
    if (!time) return ''
    const [hours, minutes] = time.slice(0, 5).split(':')
    const h = parseInt(hours)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  const getHeadcountInfo = (a) => {
    if (a.headcount_percentage != null) {
      const est = a.room_capacity ? Math.round((a.headcount_percentage / 100) * a.room_capacity) : null
      return { isPercent: true, value: a.headcount_percentage, estimated: est }
    }
    if (a.headcount != null && a.headcount > 0) {
      return { isPercent: false, value: a.headcount, estimated: null }
    }
    return null
  }

  // Group by date
  const grouped = assignments.reduce((acc, a) => {
    const date = a.date
    if (!acc[date]) acc[date] = []
    acc[date].push(a)
    return acc
  }, {})

  Object.keys(grouped).forEach(date => {
    grouped[date].sort((a, b) => a.start_time.localeCompare(b.start_time))
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">My Schedule</h1>
        <p className="text-sm text-slate-500 mt-1">
          {assignments.length} session{assignments.length !== 1 ? 's' : ''} assigned
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-200">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Assignments Yet</h3>
          <p className="text-slate-500 text-sm mb-6">
            Set your availability so the admin can assign you to sessions.
          </p>
          <Link to="/portal/availability" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-emerald-700 transition-colors">
            Set Availability
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, sessions]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {new Date(date + 'T00:00:00').getDate()}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{formatDate(date)}</div>
                    <div className="text-xs text-slate-500">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</div>
                  </div>
                </div>

                {/* Sessions */}
                <div className="space-y-3 ml-2 pl-4 border-l-2 border-emerald-200">
                  {sessions.map(a => {
                    const headcount = getHeadcountInfo(a)
                    const isEditing = editingId === a.session_id

                    return (
                      <div key={a.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        {/* Session Info */}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-900 leading-tight">{a.session_name}</h3>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm">
                                <span className="text-emerald-600 font-medium">
                                  {formatTime(a.start_time)} - {formatTime(a.end_time)}
                                </span>
                                {a.room_name && (
                                  <span className="text-slate-500">
                                    {a.room_name}
                                    {a.room_capacity && <span className="text-slate-400"> · {a.room_capacity} seats</span>}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Headcount Display (when not editing) */}
                            {!isEditing && (
                              <button
                                onClick={() => startEditing(a)}
                                className="flex-shrink-0 text-center min-w-[70px] p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                              >
                                {headcount ? (
                                  <>
                                    <div className={`text-lg font-bold ${headcount.isPercent ? 'text-blue-600' : 'text-slate-700'}`}>
                                      {headcount.value}{headcount.isPercent ? '%' : ''}
                                    </div>
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                                      {headcount.isPercent ? (headcount.estimated ? `~${headcount.estimated}` : 'est') : 'count'}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="text-lg font-bold text-slate-300">--</div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-wide">Add</div>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Edit Headcount Panel */}
                        {isEditing && (
                          <div className="bg-slate-50 border-t border-slate-200 p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium text-slate-700">Update Headcount</span>
                              {a.room_capacity && (
                                <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-md">
                                  Capacity: {a.room_capacity}
                                </span>
                              )}
                            </div>

                            <div className="flex gap-2 mb-3">
                              <button
                                onClick={() => { setInputMode('percentage'); setHeadcountValue('') }}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                                  inputMode === 'percentage'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                % Full
                              </button>
                              <button
                                onClick={() => { setInputMode('exact'); setHeadcountValue('') }}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                                  inputMode === 'exact'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                Exact #
                              </button>
                            </div>

                            <div className="flex gap-2">
                              <div className="flex-1 relative">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-lg font-semibold text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                  placeholder={inputMode === 'percentage' ? '0-100' : 'Count'}
                                  value={headcountValue}
                                  onChange={e => setHeadcountValue(e.target.value)}
                                  min="0"
                                  max={inputMode === 'percentage' ? '100' : undefined}
                                  autoFocus
                                />
                                {inputMode === 'percentage' && (
                                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">%</span>
                                )}
                              </div>
                            </div>

                            {inputMode === 'percentage' && headcountValue && a.room_capacity && (
                              <div className="mt-2 text-center text-sm text-slate-500">
                                ≈ <strong>{Math.round((parseInt(headcountValue) / 100) * a.room_capacity)}</strong> people
                              </div>
                            )}

                            <div className="flex gap-2 mt-4">
                              <button
                                onClick={() => setEditingId(null)}
                                className="flex-1 py-2.5 px-4 bg-white border border-slate-300 rounded-xl text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveHeadcount(a.session_id)}
                                disabled={saving || !headcountValue}
                                className="flex-1 py-2.5 px-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Tip */}
      {assignments.length > 0 && (
        <div className="mt-8 flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-sm text-blue-800">
            <strong>Tip:</strong> Tap the headcount box to update attendance after each session.
          </div>
        </div>
      )}
    </div>
  )
}
