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
      await sessionsService.updateHeadcount(sessionId, parseInt(headcountValue))
      toast.success('Headcount updated')
      setEditingHeadcount(null)
      loadData()
    } catch (err) {
      toast.error('Failed to update headcount')
    }
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
    return time.slice(0, 5)
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
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {editingHeadcount === a.session_id ? (
                          <div className="flex flex-wrap gap-2 items-center">
                            <input
                              type="number"
                              className="form-input w-20 md:w-24 text-sm py-1.5"
                              placeholder="Count"
                              value={headcountValue}
                              onChange={e => setHeadcountValue(e.target.value)}
                              min="0"
                            />
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
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <span className="text-xs text-slate-500 block">Headcount</span>
                              <span className="text-lg font-semibold text-slate-700">
                                {a.headcount ?? '-'}
                              </span>
                            </div>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => {
                                setEditingHeadcount(a.session_id)
                                setHeadcountValue(a.headcount || '')
                              }}
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
