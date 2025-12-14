import { useState, useEffect } from 'react'
import { moderatorsService } from '../../services/api'
import { useToast } from '../../context/ToastContext'

export default function Moderators() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [moderators, setModerators] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [expandedData, setExpandedData] = useState(null)

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
      if (expandedId === id) {
        setExpandedId(null)
        setExpandedData(null)
      }
    } catch (err) {
      toast.error('Failed to remove moderator')
    }
  }

  const toggleExpand = async (mod) => {
    if (expandedId === mod.id) {
      setExpandedId(null)
      setExpandedData(null)
      return
    }

    try {
      const response = await moderatorsService.getById(mod.id)
      setExpandedData(response.data.data)
      setExpandedId(mod.id)
    } catch (err) {
      toast.error('Failed to load moderator details')
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const formatTime = (time) => {
    if (!time) return ''
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
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

      {moderators.length === 0 ? (
        <div className="empty-state card">
          <h3>No moderators registered</h3>
          <p>Share the registration link with volunteers</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {moderators.map((mod, index) => (
            <div key={mod.id}>
              <div
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 ${
                  index !== 0 ? 'border-t border-slate-200' : ''
                } ${expandedId === mod.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900">{mod.name}</div>
                  <div className="text-sm text-slate-500">{mod.email}</div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-sm font-medium">{parseFloat(mod.total_availability_hours || 0).toFixed(1)}h</div>
                    <div className="text-xs text-slate-500">Available</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium">{mod.assignment_count || 0}</div>
                    <div className="text-xs text-slate-500">Sessions</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className={`btn btn-sm ${expandedId === mod.id ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => toggleExpand(mod)}
                    >
                      {expandedId === mod.id ? 'Hide' : 'View'}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(mod.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === mod.id && expandedData && (
                <div className="bg-slate-50 border-t border-slate-200 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Contact Info */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Contact Info</h4>
                      <div className="space-y-2 text-sm">
                        <p><span className="text-slate-500">Email:</span> {expandedData.email}</p>
                        <p><span className="text-slate-500">Phone:</span> {expandedData.phone || 'Not provided'}</p>
                        <p><span className="text-slate-500">Preference:</span> {expandedData.schedule_preference?.replace('_', ' ') || 'None'}</p>
                      </div>
                    </div>

                    {/* Availability */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                        Availability ({expandedData.availability?.length || 0} slots)
                      </h4>
                      {expandedData.availability?.length === 0 ? (
                        <p className="text-sm text-slate-500">No availability set</p>
                      ) : (
                        <div className="space-y-1 text-sm max-h-40 overflow-y-auto">
                          {expandedData.availability?.map((slot, i) => (
                            <div key={i} className="flex justify-between py-1 border-b border-slate-200 last:border-0">
                              <span className="text-slate-600">{formatDate(slot.date)}</span>
                              <span className="font-medium">{formatTime(slot.start_time)} - {formatTime(slot.end_time)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Assignments */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                        Assignments ({expandedData.assignments?.length || 0})
                      </h4>
                      {expandedData.assignments?.length === 0 ? (
                        <p className="text-sm text-slate-500">No assignments yet</p>
                      ) : (
                        <div className="space-y-2 text-sm max-h-40 overflow-y-auto">
                          {expandedData.assignments?.map((a, i) => (
                            <div key={i} className="p-2 bg-white rounded border border-slate-200">
                              <div className="font-medium text-slate-900">{a.session_name}</div>
                              <div className="text-xs text-slate-500">
                                {formatDate(a.date)} • {formatTime(a.start_time)} - {formatTime(a.end_time)}
                              </div>
                              {a.room_name && <div className="text-xs text-blue-600">{a.room_name}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
