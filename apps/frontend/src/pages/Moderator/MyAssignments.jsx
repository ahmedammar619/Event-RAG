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
    const date = new Date(dateStr + 'T00:00:00')
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
    <div className="my-assignments-page">
      <div className="my-assignments-container">
        <div className="my-assignments-header">
          <Link to="/" className="back-link">&larr; Back to Home</Link>
          <h1>My Assignments</h1>
          <p>Hello, <strong>{moderator?.name}</strong>! Here are your assigned sessions.</p>
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
          <div className="assignments-list">
            {Object.entries(groupedAssignments).map(([date, dayAssignments]) => (
              <div key={date} className="day-group">
                <h2 className="day-title">{formatDate(date)}</h2>
                <div className="day-sessions">
                  {dayAssignments.map(a => (
                    <div key={a.id} className="session-card card">
                      <div className="session-info">
                        <h3>{a.session_name}</h3>
                        <p className="session-time">
                          {a.start_time.slice(0, 5)} - {a.end_time.slice(0, 5)}
                        </p>
                        {a.room_name && (
                          <p className="session-room">{a.room_name}</p>
                        )}
                      </div>

                      <div className="headcount-section">
                        {editingHeadcount === a.session_id ? (
                          <div className="headcount-edit">
                            <input
                              type="number"
                              className="form-input"
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
                          <div className="headcount-display">
                            <span className="headcount-label">Headcount:</span>
                            <span className="headcount-value">
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

        <div className="actions-footer">
          <Link to={`/availability/${moderatorId}`} className="btn btn-outline">
            Update Availability
          </Link>
        </div>
      </div>
      <Footer />

      <style>{`
        .my-assignments-page {
          min-height: 100vh;
          padding: 2rem;
          padding-bottom: 5rem;
          background: var(--bg);
        }

        .my-assignments-container {
          max-width: 700px;
          margin: 0 auto;
        }

        .my-assignments-header {
          margin-bottom: 2rem;
        }

        .back-link {
          display: inline-block;
          margin-bottom: 1rem;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .my-assignments-header h1 {
          font-size: 1.75rem;
          margin-bottom: 0.5rem;
        }

        .day-group {
          margin-bottom: 2rem;
        }

        .day-title {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid var(--primary);
        }

        .day-sessions {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .session-card {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 1.25rem;
        }

        .session-info h3 {
          font-size: 1.125rem;
          margin-bottom: 0.25rem;
        }

        .session-time {
          font-size: 1rem;
          color: var(--primary);
          font-weight: 500;
        }

        .session-room {
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        .headcount-section {
          text-align: right;
        }

        .headcount-display {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .headcount-label {
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        .headcount-value {
          font-size: 1.125rem;
          font-weight: 600;
        }

        .headcount-edit {
          display: flex;
          gap: 0.5rem;
        }

        .headcount-edit input {
          width: 100px;
        }

        .actions-footer {
          margin-top: 2rem;
          text-align: center;
        }

        @media (max-width: 640px) {
          .session-card {
            flex-direction: column;
            gap: 1rem;
          }

          .headcount-section {
            text-align: left;
            width: 100%;
          }

          .headcount-edit {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  )
}
