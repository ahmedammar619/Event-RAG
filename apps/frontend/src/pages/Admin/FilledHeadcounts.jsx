import { useState, useEffect } from 'react'
import { exportService, sessionsService, headcountService } from '../../services/api'
import { useToast } from '../../context/ToastContext'

// Helper to format time values
const formatTime = (time) => {
  if (!time) return ''
  if (typeof time === 'string') return time.slice(0, 5)
  if (time.hours !== undefined) {
    return `${String(time.hours).padStart(2, '0')}:${String(time.minutes || 0).padStart(2, '0')}`
  }
  return String(time).slice(0, 5)
}

export default function FilledHeadcounts() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [headcounts, setHeadcounts] = useState([])
  const [total, setTotal] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('recent') // 'recent', 'date', 'headcount'

  // Editing state
  const [editingId, setEditingId] = useState(null)
  const [editingRagId, setEditingRagId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [editMode, setEditMode] = useState('percentage') // 'percentage' or 'exact'
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadHeadcounts()
  }, [])

  const loadHeadcounts = async () => {
    try {
      const response = await exportService.getFilledHeadcounts()
      setHeadcounts(response.data.data.sessions)
      setTotal(response.data.data.total)
    } catch (err) {
      toast.error('Failed to load headcount data')
    } finally {
      setLoading(false)
    }
  }

  const startEditing = (session) => {
    setEditingId(session.id)
    setEditingRagId(session.rag_id)
    if (session.headcount_percentage !== null) {
      setEditMode('percentage')
      setEditValue(String(session.headcount_percentage))
    } else {
      setEditMode('exact')
      setEditValue(String(session.headcount || ''))
    }
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingRagId(null)
    setEditValue('')
    setEditMode('percentage')
  }

  const saveHeadcount = async () => {
    setSaving(true)
    try {
      const value = parseInt(editValue) || 0

      if (editMode === 'percentage' && (value < 0 || value > 100)) {
        toast.error('Percentage must be between 0 and 100')
        setSaving(false)
        return
      }

      const data = editMode === 'percentage'
        ? { headcount_percentage: value }
        : { headcount: value }

      // Update in both databases if IDs exist
      if (editingId) {
        await sessionsService.updateHeadcount(editingId, data)
      }
      if (editingRagId) {
        await headcountService.updateHeadcount(editingRagId, data)
      }

      toast.success('Headcount updated')
      cancelEditing()
      loadHeadcounts()
    } catch (err) {
      toast.error('Failed to update headcount')
    } finally {
      setSaving(false)
    }
  }

  // Filter and sort headcounts
  const filteredHeadcounts = headcounts
    .filter(h => {
      if (!searchTerm) return true
      const search = searchTerm.toLowerCase()
      return (
        h.name?.toLowerCase().includes(search) ||
        h.room_name?.toLowerCase().includes(search) ||
        h.speaker?.toLowerCase().includes(search)
      )
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          if (a.date !== b.date) return a.date.localeCompare(b.date)
          return formatTime(a.start_time).localeCompare(formatTime(b.start_time))
        case 'headcount':
          const aVal = a.estimated_headcount || a.headcount || 0
          const bVal = b.estimated_headcount || b.headcount || 0
          return bVal - aVal // Highest first
        case 'recent':
        default:
          // Sort by ID descending (prefer main DB id, then rag_id)
          const aId = a.id || a.rag_id || 0
          const bId = b.id || b.rag_id || 0
          return bId - aId
      }
    })

  // Calculate total estimated attendance
  const totalAttendance = filteredHeadcounts.reduce((sum, h) =>
    sum + (h.estimated_headcount || h.headcount || 0), 0
  )

  // Count by source
  const mainDbCount = filteredHeadcounts.filter(h => h.headcount_source === 'main_db').length
  const ragDbCount = filteredHeadcounts.filter(h => h.headcount_source === 'rag_db').length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1>Filled Headcounts</h1>
          <p className="text-slate-500">Sessions with recorded attendance data from both databases</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="card p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <div className="text-3xl font-bold">{total}</div>
          <div className="text-emerald-100 text-sm">Total Filled</div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="text-3xl font-bold">{totalAttendance.toLocaleString()}</div>
          <div className="text-blue-100 text-sm">Est. Attendance</div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="text-3xl font-bold">
            {total > 0 ? Math.round(totalAttendance / total) : 0}
          </div>
          <div className="text-purple-100 text-sm">Avg per Session</div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
          <div className="text-3xl font-bold">{mainDbCount}</div>
          <div className="text-indigo-100 text-sm">From Main DB</div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-teal-500 to-teal-600 text-white">
          <div className="text-3xl font-bold">{ragDbCount}</div>
          <div className="text-teal-100 text-sm">From RAG DB</div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="text-3xl font-bold">{filteredHeadcounts.length}</div>
          <div className="text-orange-100 text-sm">Showing</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by session name, room, or speaker..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="recent">Most Recent</option>
              <option value="date">By Date</option>
              <option value="headcount">By Attendance</option>
            </select>
          </div>
        </div>
      </div>

      {/* Headcount List */}
      {filteredHeadcounts.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            {searchTerm ? 'No matching sessions found' : 'No headcount data yet'}
          </h3>
          <p className="text-slate-500">
            {searchTerm
              ? 'Try adjusting your search terms'
              : 'Headcount data will appear here once sessions have attendance recorded'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHeadcounts.map((session, index) => {
            const isEditing = (editingId === session.id && session.id) ||
                              (editingRagId === session.rag_id && session.rag_id && !session.id)

            return (
              <div
                key={`${session.id || 'rag'}-${session.rag_id || 'main'}`}
                className="card p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Session Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-900 truncate" title={session.name}>
                            {session.name}
                          </h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            session.headcount_source === 'main_db'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-teal-100 text-teal-700'
                          }`}>
                            {session.headcount_source === 'main_db' ? 'Main DB' : 'RAG DB'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {session.date}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatTime(session.start_time)} - {formatTime(session.end_time)}
                          </span>
                          {session.room_name && (
                            <span className="inline-flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                              {session.room_name}
                            </span>
                          )}
                        </div>
                        {session.speaker && (
                          <div className="mt-1 text-sm text-slate-600 truncate">
                            <span className="font-medium">Speaker:</span> {session.speaker}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Headcount Display/Edit */}
                  <div className="flex items-center gap-4 lg:gap-6">
                    {isEditing ? (
                      <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg">
                        <select
                          value={editMode}
                          onChange={(e) => {
                            setEditMode(e.target.value)
                            setEditValue('')
                          }}
                          className="px-2 py-1 border border-slate-200 rounded text-sm"
                        >
                          <option value="percentage">%</option>
                          <option value="exact">Exact</option>
                        </select>
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder={editMode === 'percentage' ? '0-100' : 'Count'}
                          className="w-20 px-2 py-1 border border-slate-200 rounded text-sm"
                          min="0"
                          max={editMode === 'percentage' ? '100' : undefined}
                          autoFocus
                        />
                        <button
                          onClick={saveHeadcount}
                          disabled={saving}
                          className="px-3 py-1 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {saving ? '...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-sm hover:bg-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Percentage Badge */}
                        {session.headcount_percentage !== null && (
                          <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-bold text-lg">
                              {session.headcount_percentage}%
                            </div>
                            <div className="text-xs text-slate-500 mt-1">Capacity</div>
                          </div>
                        )}

                        {/* Exact Count */}
                        {session.headcount !== null && !session.headcount_percentage && (
                          <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white font-bold text-lg">
                              {session.headcount}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">People</div>
                          </div>
                        )}

                        {/* Estimated/Calculated */}
                        <div className="text-center min-w-[80px]">
                          <div className="text-2xl font-bold text-slate-800">
                            {session.estimated_headcount?.toLocaleString() || session.headcount?.toLocaleString() || '-'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {session.headcount_percentage !== null ? 'Estimated' : 'Attendees'}
                          </div>
                          {session.room_capacity && (
                            <div className="text-xs text-slate-400">
                              of {session.room_capacity} capacity
                            </div>
                          )}
                        </div>

                        {/* Edit Button */}
                        <button
                          onClick={() => startEditing(session)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit headcount"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Moderators */}
                {session.assigned_moderators?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs text-slate-500">Moderators:</span>
                      {session.assigned_moderators.map((mod, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
                        >
                          {mod.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Footer Info */}
      {filteredHeadcounts.length > 0 && (
        <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Data merged from Main DB and RAG DB. Main DB values take priority.
              Click the edit icon to update headcount values.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
