import { useState, useEffect } from 'react'
import { moderatorsService } from '../../services/api'
import { useToast } from '../../context/ToastContext'

export default function Moderators() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [moderators, setModerators] = useState([])
  const [selectedModerator, setSelectedModerator] = useState(null)

  useEffect(() => {
    loadModerators()
  }, [])

  const loadModerators = async () => {
    try {
      const response = await moderatorsService.getAll()
      setModerators(response.data.data)
    } catch (err) {
      toast.error('Failed to load moderators')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to remove this moderator?')) return

    try {
      await moderatorsService.delete(id)
      toast.success('Moderator removed')
      loadModerators()
      if (selectedModerator?.id === id) {
        setSelectedModerator(null)
      }
    } catch (err) {
      toast.error('Failed to remove moderator')
    }
  }

  const viewDetails = async (mod) => {
    try {
      const response = await moderatorsService.getById(mod.id)
      setSelectedModerator(response.data.data)
    } catch (err) {
      toast.error('Failed to load moderator details')
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>
  }

  return (
    <div>
      <div className="page-header">
        <h1>Moderators</h1>
        <p>{moderators.length} registered volunteers</p>
      </div>

      <div className="moderators-layout">
        <div className="moderators-list">
          {moderators.length === 0 ? (
            <div className="empty-state card">
              <h3>No moderators registered</h3>
              <p>Share the registration link with volunteers</p>
            </div>
          ) : (
            <div className="table-container card">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Availability</th>
                    <th>Assignments</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {moderators.map(mod => (
                    <tr key={mod.id} className={selectedModerator?.id === mod.id ? 'selected' : ''}>
                      <td><strong>{mod.name}</strong></td>
                      <td>{mod.email}</td>
                      <td>{parseFloat(mod.total_availability_hours || 0).toFixed(1)}h</td>
                      <td>
                        <span className="badge badge-info">
                          {mod.assignment_count} sessions
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-outline btn-sm" onClick={() => viewDetails(mod)}>
                            View
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(mod.id)}>
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedModerator && (
          <div className="moderator-detail card">
            <div className="card-header">
              <h3 className="card-title">{selectedModerator.name}</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedModerator(null)}>
                Close
              </button>
            </div>

            <div className="detail-section">
              <h4>Contact Info</h4>
              <p><strong>Email:</strong> {selectedModerator.email}</p>
              <p><strong>Phone:</strong> {selectedModerator.phone || 'Not provided'}</p>
            </div>

            <div className="detail-section">
              <h4>Availability</h4>
              {selectedModerator.availability?.length === 0 ? (
                <p className="text-muted">No availability set</p>
              ) : (
                <ul className="availability-list">
                  {selectedModerator.availability?.map((slot, i) => (
                    <li key={i}>
                      {formatDate(slot.date)}: {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="detail-section">
              <h4>Assignments ({selectedModerator.assignments?.length || 0})</h4>
              {selectedModerator.assignments?.length === 0 ? (
                <p className="text-muted">No assignments yet</p>
              ) : (
                <ul className="assignments-list">
                  {selectedModerator.assignments?.map((a, i) => (
                    <li key={i}>
                      <strong>{a.session_name}</strong>
                      <br />
                      <span className="text-sm text-muted">
                        {formatDate(a.date)} | {a.start_time.slice(0, 5)} - {a.end_time.slice(0, 5)} | {a.room_name || 'No room'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .moderators-layout {
          display: grid;
          grid-template-columns: 1fr 350px;
          gap: 1rem;
        }

        @media (max-width: 1024px) {
          .moderators-layout {
            grid-template-columns: 1fr;
          }
        }

        .table tr.selected {
          background: #eff6ff;
        }

        .moderator-detail {
          position: sticky;
          top: 5rem;
          height: fit-content;
        }

        .detail-section {
          margin-bottom: 1.5rem;
        }

        .detail-section h4 {
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .availability-list,
        .assignments-list {
          list-style: none;
          padding: 0;
        }

        .availability-list li,
        .assignments-list li {
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--border);
        }

        .availability-list li:last-child,
        .assignments-list li:last-child {
          border-bottom: none;
        }
      `}</style>
    </div>
  )
}
