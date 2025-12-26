import { useState, useEffect, useMemo } from 'react'
import { headcountService } from '../../services/api'

export default function Headcount() {
  const [sessions, setSessions] = useState([])
  const [rooms, setRooms] = useState([])
  const [dates, setDates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedRoom, setSelectedRoom] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [timeFilter, setTimeFilter] = useState('now') // now, soon, upcoming, past, all

  // Editing state
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [editMode, setEditMode] = useState('percentage') // percentage or exact
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  // Current time for filtering
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000) // Update every minute
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [sessionsRes, roomsRes, datesRes] = await Promise.all([
        headcountService.getSessions({}),
        headcountService.getRooms(),
        headcountService.getDates()
      ])
      setSessions(sessionsRes.data.data)
      setRooms(roomsRes.data.data)
      setDates(datesRes.data.data)

      // Auto-select today's date if available
      const today = new Date().toISOString().split('T')[0]
      const todayExists = datesRes.data.data.some(d => {
        const dateStr = typeof d === 'string' ? d : d.toISOString?.().split('T')[0]
        return dateStr === today
      })
      if (todayExists) {
        setSelectedDate(today)
      } else if (datesRes.data.data.length > 0) {
        const firstDate = datesRes.data.data[0]
        setSelectedDate(typeof firstDate === 'string' ? firstDate.split('T')[0] : firstDate)
      }
    } catch (err) {
      setError('Failed to load sessions')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const getSessionStatus = (session) => {
    const now = currentTime
    const sessionDate = new Date(session.date).toISOString().split('T')[0]
    const todayDate = now.toISOString().split('T')[0]

    if (sessionDate < todayDate) return 'past'
    if (sessionDate > todayDate) return 'future'

    // Same day - check times
    const [startH, startM] = session.time_start.split(':').map(Number)
    const [endH, endM] = session.time_end.split(':').map(Number)

    const sessionStart = new Date(now)
    sessionStart.setHours(startH, startM, 0, 0)

    const sessionEnd = new Date(now)
    sessionEnd.setHours(endH, endM, 0, 0)

    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

    if (now >= sessionStart && now <= sessionEnd) return 'now'
    if (sessionStart > now && sessionStart <= oneHourFromNow) return 'soon'
    if (sessionStart > oneHourFromNow) return 'upcoming'
    return 'past'
  }

  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // Date filter
      if (selectedDate) {
        const sessionDate = new Date(session.date).toISOString().split('T')[0]
        if (sessionDate !== selectedDate) return false
      }

      // Room filter
      if (selectedRoom && session.room !== selectedRoom) return false

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesTitle = session.title?.toLowerCase().includes(query)
        const matchesSpeaker = session.speakers?.toLowerCase().includes(query)
        const matchesRoom = session.room?.toLowerCase().includes(query)
        if (!matchesTitle && !matchesSpeaker && !matchesRoom) return false
      }

      // Time filter
      if (timeFilter !== 'all') {
        const status = getSessionStatus(session)
        if (timeFilter === 'now' && status !== 'now') return false
        if (timeFilter === 'soon' && status !== 'soon') return false
        if (timeFilter === 'upcoming' && status !== 'upcoming' && status !== 'soon') return false
        if (timeFilter === 'past' && status !== 'past') return false
      }

      return true
    }).sort((a, b) => {
      // Sort by time_start
      return a.time_start.localeCompare(b.time_start)
    })
  }, [sessions, selectedDate, selectedRoom, searchQuery, timeFilter, currentTime])

  const sessionCounts = useMemo(() => {
    const dateFiltered = selectedDate
      ? sessions.filter(s => new Date(s.date).toISOString().split('T')[0] === selectedDate)
      : sessions

    return {
      now: dateFiltered.filter(s => getSessionStatus(s) === 'now').length,
      soon: dateFiltered.filter(s => getSessionStatus(s) === 'soon').length,
      upcoming: dateFiltered.filter(s => getSessionStatus(s) === 'upcoming' || getSessionStatus(s) === 'soon').length,
      past: dateFiltered.filter(s => getSessionStatus(s) === 'past').length,
      all: dateFiltered.length
    }
  }, [sessions, selectedDate, currentTime])

  const startEditing = (session) => {
    setEditingId(session.id)
    if (session.headcount_percentage !== null && session.headcount_percentage !== undefined) {
      setEditMode('percentage')
      setEditValue(session.headcount_percentage.toString())
    } else if (session.headcount !== null && session.headcount !== undefined) {
      setEditMode('exact')
      setEditValue(session.headcount.toString())
    } else {
      setEditMode('percentage')
      setEditValue('')
    }
  }

  const saveHeadcount = async (sessionId) => {
    const value = parseInt(editValue)
    if (isNaN(value) || value < 0) {
      showToast('Please enter a valid number', 'error')
      return
    }
    if (editMode === 'percentage' && value > 100) {
      showToast('Percentage cannot exceed 100', 'error')
      return
    }

    setSaving(true)
    try {
      const data = editMode === 'percentage'
        ? { headcount_percentage: value }
        : { headcount: value }

      await headcountService.updateHeadcount(sessionId, data)
      showToast('Headcount saved!')
      setEditingId(null)

      // Update local state
      setSessions(prev => prev.map(s =>
        s.id === sessionId
          ? {
              ...s,
              headcount: editMode === 'exact' ? value : null,
              headcount_percentage: editMode === 'percentage' ? value : null
            }
          : s
      ))
    } catch (err) {
      showToast('Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const formatTime = (time) => {
    const [h, m] = time.split(':')
    const hour = parseInt(h)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour % 12 || 12
    return `${hour12}:${m} ${ampm}`
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const getStatusBadge = (status) => {
    const styles = {
      now: 'bg-green-500 text-white animate-pulse',
      soon: 'bg-amber-500 text-white',
      upcoming: 'bg-blue-500 text-white',
      past: 'bg-slate-400 text-white',
      future: 'bg-blue-500 text-white'
    }
    const labels = {
      now: 'LIVE NOW',
      soon: 'Starting Soon',
      upcoming: 'Upcoming',
      past: 'Ended',
      future: 'Upcoming'
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading sessions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-xl mb-4">{error}</p>
          <button onClick={loadData} className="px-6 py-2 bg-blue-500 rounded-lg hover:bg-blue-600 transition">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium transition-all transform ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-3xl">📊</span>
                Session Headcount
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} •
                {' '}{filteredSessions.length} sessions shown
              </p>
            </div>
            <div className="text-right">
              <div className="text-slate-400 text-xs uppercase tracking-wide">Current Time</div>
              <div className="text-2xl font-mono text-white">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Search by session name, speaker, or room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-12 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-3">
            {/* Date Selector */}
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" className="bg-slate-800">All Days</option>
              {dates.map(date => {
                const dateStr = typeof date === 'string' ? date.split('T')[0] : date
                return (
                  <option key={dateStr} value={dateStr} className="bg-slate-800">
                    {formatDate(dateStr)}
                  </option>
                )
              })}
            </select>

            {/* Room Selector */}
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
            >
              <option value="" className="bg-slate-800">All Rooms</option>
              {rooms.map(room => (
                <option key={room} value={room} className="bg-slate-800">{room}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Time Filter Tabs */}
        <div className="max-w-7xl mx-auto px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {[
              { value: 'now', label: 'Happening Now', icon: '🔴', count: sessionCounts.now },
              { value: 'soon', label: 'Starting Soon', icon: '⏰', count: sessionCounts.soon },
              { value: 'upcoming', label: 'Upcoming', icon: '📅', count: sessionCounts.upcoming },
              { value: 'past', label: 'Past', icon: '✓', count: sessionCounts.past },
              { value: 'all', label: 'All', icon: '📋', count: sessionCounts.all }
            ].map(tab => (
              <button
                key={tab.value}
                onClick={() => setTimeFilter(tab.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                  timeFilter === tab.value
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  timeFilter === tab.value ? 'bg-white/20' : 'bg-white/10'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Sessions List */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-white mb-2">No sessions found</h3>
            <p className="text-slate-400">Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredSessions.map(session => {
              const status = getSessionStatus(session)
              const isEditing = editingId === session.id

              return (
                <div
                  key={session.id}
                  className={`bg-white/5 backdrop-blur border rounded-xl overflow-hidden transition-all hover:bg-white/10 ${
                    status === 'now' ? 'border-green-500/50 ring-1 ring-green-500/30' :
                    status === 'soon' ? 'border-amber-500/50' :
                    'border-white/10'
                  }`}
                >
                  <div className="p-4 md:p-5">
                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                      {/* Time Column */}
                      <div className="flex-shrink-0 md:w-32 text-center md:text-left">
                        <div className="text-lg font-bold text-white">
                          {formatTime(session.time_start)}
                        </div>
                        <div className="text-sm text-slate-400">
                          to {formatTime(session.time_end)}
                        </div>
                        <div className="mt-2">
                          {getStatusBadge(status)}
                        </div>
                      </div>

                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-white mb-1 leading-tight">
                          {session.title}
                        </h3>
                        {session.speakers && (
                          <p className="text-blue-300 text-sm mb-2">
                            👤 {session.speakers}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                          {session.room && (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {session.room}
                            </span>
                          )}
                          {session.track && (
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">
                              {session.track}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Headcount Section */}
                      <div className="flex-shrink-0 md:w-56">
                        {isEditing ? (
                          <div className="bg-white/10 rounded-lg p-3 space-y-3">
                            <div className="flex gap-1">
                              <button
                                onClick={() => setEditMode('percentage')}
                                className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition ${
                                  editMode === 'percentage'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                                }`}
                              >
                                % Full
                              </button>
                              <button
                                onClick={() => setEditMode('exact')}
                                className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition ${
                                  editMode === 'exact'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                                }`}
                              >
                                Exact #
                              </button>
                            </div>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max={editMode === 'percentage' ? 100 : undefined}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                placeholder={editMode === 'percentage' ? '0-100' : 'Count'}
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                              />
                              {editMode === 'percentage' && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                              )}
                            </div>
                            {editMode === 'percentage' && editValue && session.room_capacity && (
                              <div className="text-center text-xs text-slate-400">
                                ≈ {Math.round((parseInt(editValue) / 100) * session.room_capacity)} people
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveHeadcount(session.id)}
                                disabled={saving}
                                className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium transition disabled:opacity-50"
                              >
                                {saving ? '...' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded font-medium transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditing(session)}
                            className="w-full bg-white/10 hover:bg-white/20 border border-dashed border-white/30 hover:border-blue-400 rounded-lg p-4 text-center transition-all group"
                          >
                            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Headcount</div>
                            {session.headcount_percentage !== null && session.headcount_percentage !== undefined ? (
                              <div className="text-2xl font-bold text-blue-400">
                                {session.headcount_percentage}%
                                <span className="text-sm font-normal text-slate-400 ml-1">full</span>
                              </div>
                            ) : session.headcount !== null && session.headcount !== undefined ? (
                              <div className="text-2xl font-bold text-blue-400">
                                {session.headcount}
                                <span className="text-sm font-normal text-slate-400 ml-1">people</span>
                              </div>
                            ) : (
                              <div className="text-slate-500 flex items-center justify-center gap-2">
                                <span>Tap to add</span>
                                <svg className="w-4 h-4 group-hover:text-blue-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </div>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-slate-500 text-sm">
        <p>MASCON 2025 • Session Headcount Tracker</p>
      </footer>
    </div>
  )
}
