import { useState, useEffect } from 'react'
import { exportService } from '../../services/api'
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
          return b.id - a.id // Most recent first (higher ID)
      }
    })

  // Calculate total estimated attendance
  const totalAttendance = filteredHeadcounts.reduce((sum, h) =>
    sum + (h.estimated_headcount || h.headcount || 0), 0
  )

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
          <p className="text-slate-500">Sessions with recorded attendance data</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <div className="text-3xl font-bold">{total}</div>
          <div className="text-emerald-100 text-sm">Sessions with Headcount</div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="text-3xl font-bold">{totalAttendance.toLocaleString()}</div>
          <div className="text-blue-100 text-sm">Total Estimated Attendance</div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="text-3xl font-bold">
            {total > 0 ? Math.round(totalAttendance / total) : 0}
          </div>
          <div className="text-purple-100 text-sm">Average per Session</div>
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
          {filteredHeadcounts.map((session, index) => (
            <div
              key={session.id}
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
                      <h3 className="font-semibold text-slate-900 truncate" title={session.name}>
                        {session.name}
                      </h3>
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

                {/* Headcount Display */}
                <div className="flex items-center gap-4 lg:gap-6">
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
          ))}
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
              Showing {filteredHeadcounts.length} session{filteredHeadcounts.length !== 1 ? 's' : ''} with recorded headcount data.
              Sorted by {sortBy === 'recent' ? 'most recently added' : sortBy === 'date' ? 'event date' : 'highest attendance'}.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
