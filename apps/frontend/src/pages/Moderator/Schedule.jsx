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
  const [editingHeadcount, setEditingHeadcount] = useState(null)
  const [headcountValue, setHeadcountValue] = useState('')
  const [inputMode, setInputMode] = useState('percentage') // 'percentage' or 'exact'

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

  const updateHeadcount = async (sessionId) => {
    try {
      const value = parseInt(headcountValue)
      if (isNaN(value) || value < 0) {
        toast.error('Please enter a valid number')
        return
      }

      const data = inputMode === 'percentage'
        ? { headcount_percentage: value }
        : { headcount: value }

      await sessionsService.updateHeadcount(sessionId, data)
      toast.success('Headcount updated')
      setEditingHeadcount(null)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update headcount')
    }
  }

  const startEditing = (assignment) => {
    setEditingHeadcount(assignment.session_id)
    // Default to percentage mode, pre-fill with existing value if any
    if (assignment.headcount_percentage) {
      setInputMode('percentage')
      setHeadcountValue(assignment.headcount_percentage.toString())
    } else if (assignment.headcount) {
      setInputMode('exact')
      setHeadcountValue(assignment.headcount.toString())
    } else {
      setInputMode('percentage')
      setHeadcountValue('')
    }
  }

  const getHeadcountDisplay = (assignment) => {
    if (assignment.headcount_percentage !== null && assignment.headcount_percentage !== undefined) {
      const estimated = assignment.room_capacity
        ? Math.round((assignment.headcount_percentage / 100) * assignment.room_capacity)
        : null
      return {
        type: 'percentage',
        value: assignment.headcount_percentage,
        estimated
      }
    } else if (assignment.headcount !== null && assignment.headcount !== undefined) {
      return {
        type: 'exact',
        value: assignment.headcount,
        estimated: null
      }
    }
    return null
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const dateOnly = dateStr.split('T')[0]
    const date = new Date(dateOnly + 'T00:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
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

  // Group assignments by date
  const groupedAssignments = assignments.reduce((acc, a) => {
    const date = a.date
    if (!acc[date]) acc[date] = []
    acc[date].push(a)
    return acc
  }, {})

  // Sort assignments by time within each day
  Object.keys(groupedAssignments).forEach(date => {
    groupedAssignments[date].sort((a, b) => a.start_time.localeCompare(b.start_time))
  })

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
        <h1 className="text-xl md:text-2xl font-semibold mb-2">My Schedule</h1>
        <p className="text-slate-500 text-sm md:text-base">
          Hello, <strong className="text-slate-800">{moderator?.name}</strong>! Here are your assigned sessions.
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-4">📭</div>
          <h3 className="text-lg font-semibold mb-2">No Assignments Yet</h3>
          <p className="text-slate-500 mb-6">
            You haven't been assigned to any sessions yet. Make sure to set your availability so the admin can assign you.
          </p>
          <Link to="/portal/availability" className="btn btn-primary">
            Set Availability
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6 md:gap-8">
          {Object.entries(groupedAssignments)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, dayAssignments]) => (
            <div key={date}>
              <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4 pb-2 border-b-2 border-emerald-600 text-emerald-700">
                {formatDate(date)}
              </h2>
              <div className="flex flex-col gap-3 md:gap-4">
                {dayAssignments.map(a => (
                  <div key={a.id} className="card p-4 md:p-5">
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base md:text-lg font-semibold mb-1 truncate">{a.session_name}</h3>
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 text-sm">
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                            <span>🕐</span>
                            {formatTime(a.start_time)} - {formatTime(a.end_time)}
                          </span>
                          {a.room_name && (
                            <span className="inline-flex items-center gap-1 text-slate-500">
                              <span>📍</span>
                              {a.room_name}
                              {a.room_capacity && (
                                <span className="text-slate-400">({a.room_capacity} cap)</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {editingHeadcount === a.session_id ? (
                          <div className="flex flex-col gap-2">
                            {a.room_capacity && (
                              <div className="text-xs text-slate-500">
                                Room capacity: <strong>{a.room_capacity}</strong>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2 items-center">
                              <select
                                className="form-input text-sm py-1.5"
                                value={inputMode}
                                onChange={e => {
                                  setInputMode(e.target.value)
                                  setHeadcountValue('')
                                }}
                              >
                                <option value="percentage">% Full</option>
                                <option value="exact">Exact Count</option>
                              </select>
                              <div className="relative">
                                <input
                                  type="number"
                                  className="form-input w-20 md:w-24 text-sm py-1.5 pr-6"
                                  placeholder={inputMode === 'percentage' ? '0-100' : 'Count'}
                                  value={headcountValue}
                                  onChange={e => setHeadcountValue(e.target.value)}
                                  min="0"
                                  max={inputMode === 'percentage' ? '100' : undefined}
                                />
                                {inputMode === 'percentage' && (
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                                )}
                              </div>
                              {inputMode === 'percentage' && headcountValue && a.room_capacity && (
                                <span className="text-xs text-slate-500">
                                  ≈ {Math.round((parseInt(headcountValue) / 100) * a.room_capacity)}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => updateHeadcount(a.session_id)}
                              >
                                Save
                              </button>
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() => setEditingHeadcount(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <span className="text-xs text-slate-500 block">Headcount</span>
                              {(() => {
                                const display = getHeadcountDisplay(a)
                                if (!display) {
                                  return <span className="text-lg font-semibold text-slate-400">-</span>
                                }
                                if (display.type === 'percentage') {
                                  return (
                                    <div>
                                      <span className="text-lg font-semibold text-blue-600">{display.value}%</span>
                                      {display.estimated !== null && (
                                        <span className="text-xs text-slate-500 block">≈ {display.estimated}</span>
                                      )}
                                    </div>
                                  )
                                }
                                return <span className="text-lg font-semibold text-slate-700">{display.value}</span>
                              })()}
                            </div>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => startEditing(a)}
                            >
                              Update
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {assignments.length > 0 && (
        <div className="mt-8 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
          <p className="text-sm text-emerald-800 m-0">
            <strong>Tip:</strong> After each session, update the headcount to help track attendance.
          </p>
        </div>
      )}
    </div>
  )
}
