import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { assignmentsService, moderatorsService, sessionsService } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import Footer from '../../components/common/Footer'

export default function MyAssignments() {
  const { moderatorId } = useParams()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [moderator, setModerator] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [editingHeadcount, setEditingHeadcount] = useState(null)
  const [headcountValue, setHeadcountValue] = useState('')

  useEffect(() => {
    loadData()
  }, [moderatorId])

  const loadData = async () => {
    try {
      const [modRes, assignRes] = await Promise.all([
        moderatorsService.getById(moderatorId),
        assignmentsService.getByModerator(moderatorId)
      ])

      setModerator(modRes.data.data)
      setAssignments(assignRes.data.data)
    } catch (err) {
      toast.error('Failed to load data')
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

  // Group assignments by date
  const groupedAssignments = assignments.reduce((acc, a) => {
    const date = a.date
    if (!acc[date]) acc[date] = []
    acc[date].push(a)
    return acc
  }, {})

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>
  }

  return (
    <div className="min-h-screen p-4 md:p-8 pb-20 bg-slate-50">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link to="/" className="inline-block mb-4 text-slate-500 text-sm hover:text-slate-700">
            &larr; Back to Home
          </Link>
          <h1 className="text-2xl font-semibold mb-2">My Assignments</h1>
          <p className="text-slate-500">Hello, <strong className="text-slate-800">{moderator?.name}</strong>! Here are your assigned sessions.</p>
        </div>

        {assignments.length === 0 ? (
          <div className="empty-state card">
            <h3>No assignments yet</h3>
            <p>You haven't been assigned to any sessions yet. Check back later!</p>
            <Link to={`/availability/${moderatorId}`} className="btn btn-primary mt-4">
              Update Availability
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {Object.entries(groupedAssignments).map(([date, dayAssignments]) => (
              <div key={date}>
                <h2 className="text-lg font-semibold mb-4 pb-2 border-b-2 border-blue-600">
                  {formatDate(date)}
                </h2>
                <div className="flex flex-col gap-4">
                  {dayAssignments.map(a => (
                    <div key={a.id} className="card flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 p-5">
                      <div>
                        <h3 className="text-lg font-semibold mb-1">{a.session_name}</h3>
                        <p className="text-blue-600 font-medium">
                          {a.start_time.slice(0, 5)} - {a.end_time.slice(0, 5)}
                        </p>
                        {a.room_name && (
                          <p className="text-slate-500 text-sm">{a.room_name}</p>
                        )}
                      </div>

                      <div className="sm:text-right">
                        {editingHeadcount === a.session_id ? (
                          <div className="flex flex-wrap gap-2">
                            <input
                              type="number"
                              className="form-input w-24"
                              placeholder="Enter headcount"
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
                          <div className="flex items-center gap-2 sm:justify-end">
                            <span className="text-slate-500 text-sm">Headcount:</span>
                            <span className="text-lg font-semibold">
                              {a.headcount || 'Not set'}
                            </span>
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
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link to={`/availability/${moderatorId}`} className="btn btn-outline">
            Update Availability
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
