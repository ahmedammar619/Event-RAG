import { useState, useEffect, useMemo } from 'react'
import { headcountService } from '../../services/api'
import Header from '../../components/common/Header'
import Footer from '../../components/common/Footer'

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
  const [levelFilter, setLevelFilter] = useState('all') // all, level1, other

  // Helper to check if room is Level 1
  const isLevel1Room = (room) => {
    if (!room) return false
    const normalized = room.toLowerCase().replace(/\s+/g, '')
    return normalized.startsWith('level1')
  }

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

    // Check if just ended (within last hour)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    if (sessionEnd >= oneHourAgo && sessionEnd < now) return 'just_ended'

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
        if (timeFilter === 'just_ended' && status !== 'just_ended') return false
        if (timeFilter === 'past' && status !== 'past' && status !== 'just_ended') return false
      }

      // Level filter
      if (levelFilter === 'level1' && !isLevel1Room(session.room)) return false
      if (levelFilter === 'other' && isLevel1Room(session.room)) return false

      return true
    }).sort((a, b) => {
      // Sort by time_start
      return a.time_start.localeCompare(b.time_start)
    })
  }, [sessions, selectedDate, selectedRoom, searchQuery, timeFilter, levelFilter, currentTime])

  const sessionCounts = useMemo(() => {
    // First filter by date
    const dateFiltered = selectedDate
      ? sessions.filter(s => new Date(s.date).toISOString().split('T')[0] === selectedDate)
      : sessions

    // Then filter by level for time counts
    const levelFiltered = levelFilter === 'all'
      ? dateFiltered
      : levelFilter === 'level1'
        ? dateFiltered.filter(s => isLevel1Room(s.room))
        : dateFiltered.filter(s => !isLevel1Room(s.room))

    return {
      // Time counts (affected by level filter)
      now: levelFiltered.filter(s => getSessionStatus(s) === 'now').length,
      soon: levelFiltered.filter(s => getSessionStatus(s) === 'soon').length,
      upcoming: levelFiltered.filter(s => getSessionStatus(s) === 'upcoming' || getSessionStatus(s) === 'soon').length,
      just_ended: levelFiltered.filter(s => getSessionStatus(s) === 'just_ended').length,
      past: levelFiltered.filter(s => getSessionStatus(s) === 'past' || getSessionStatus(s) === 'just_ended').length,
      all: levelFiltered.length,
      // Level counts (only affected by date filter, not level filter)
      allRooms: dateFiltered.length,
      level1: dateFiltered.filter(s => isLevel1Room(s.room)).length,
      otherRooms: dateFiltered.filter(s => !isLevel1Room(s.room)).length
    }
  }, [sessions, selectedDate, levelFilter, currentTime])

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
      now: 'bg-gradient-to-r from-green-500 to-emerald-500 text-white animate-pulse',
      just_ended: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white',
      soon: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white',
      upcoming: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white',
      past: 'bg-slate-400 text-white',
      future: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white'
    }
    const labels = {
      now: 'LIVE NOW',
      just_ended: 'Just Ended',
      soon: 'Starting Soon',
      upcoming: 'Upcoming',
      past: 'Ended',
      future: 'Upcoming'
    }
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-purple-50 via-white to-purple-50">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4 animate-pulse">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-slate-600">Loading sessions...</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-purple-50 via-white to-purple-50">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-xl text-slate-800 mb-4">{error}</p>
            <button onClick={loadData} className="px-6 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition shadow-lg shadow-purple-200">
              Retry
            </button>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-purple-50 via-white to-purple-50">
      <Header />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-xl shadow-lg text-white font-medium transition-all transform ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        {/* Page Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Session Headcount
          </h1>
          <p className="text-slate-600 max-w-md mx-auto">
            Track attendance for conference sessions in real-time
          </p>
          <p className="text-sm text-slate-500 mt-2">
            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} • {filteredSessions.length} sessions shown
          </p>
        </div>

        {/* Search & Filters Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-purple-100 p-6 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-100 to-transparent rounded-bl-full opacity-50"></div>

          <div className="relative space-y-4">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by session name, speaker, or room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-12 rounded-xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all"
              />
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filter Row */}
            <div className="flex flex-wrap gap-3 justify-center">
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 rounded-xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none bg-white transition-all"
              >
                <option value="">All Days</option>
                {dates.map(date => {
                  const dateStr = typeof date === 'string' ? date.split('T')[0] : date
                  return (
                    <option key={dateStr} value={dateStr}>
                      {formatDate(dateStr)}
                    </option>
                  )
                })}
              </select>

              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="px-4 py-2 rounded-xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none bg-white transition-all max-w-[200px]"
              >
                <option value="">All Rooms</option>
                {rooms.map(room => (
                  <option key={room} value={room}>{room}</option>
                ))}
              </select>

              {/* Level Filter */}
              <div className="flex rounded-xl border-2 border-slate-200 overflow-hidden">
                {[
                  { value: 'all', label: 'All Rooms', count: sessionCounts.allRooms },
                  { value: 'level1', label: 'Level 1', count: sessionCounts.level1 },
                  { value: 'other', label: 'Other', count: sessionCounts.otherRooms }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setLevelFilter(opt.value)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
                      levelFilter === opt.value
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-purple-50'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                      levelFilter === opt.value ? 'bg-white/20' : 'bg-purple-100'
                    }`}>
                      {opt.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Filter Tabs */}
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                { value: 'now', label: 'Happening Now', count: sessionCounts.now },
                { value: 'just_ended', label: 'Just Ended', count: sessionCounts.just_ended },
                { value: 'soon', label: 'Starting Soon', count: sessionCounts.soon },
                { value: 'upcoming', label: 'Upcoming', count: sessionCounts.upcoming },
                { value: 'past', label: 'Past', count: sessionCounts.past },
                { value: 'all', label: 'All Sessions', count: sessionCounts.all }
              ].map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setTimeFilter(tab.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                    timeFilter === tab.value
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-200'
                      : 'bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 hover:from-purple-100 hover:to-indigo-100 border border-purple-100'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    timeFilter === tab.value ? 'bg-white/20' : 'bg-purple-200/50'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sessions List */}
        {filteredSessions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl border border-purple-100 p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">No sessions found</h3>
            <p className="text-slate-500">Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSessions.map(session => {
              const status = getSessionStatus(session)
              const isEditing = editingId === session.id

              return (
                <div
                  key={session.id}
                  className={`bg-white rounded-2xl shadow-lg border-2 overflow-hidden transition-all hover:shadow-xl ${
                    status === 'now' ? 'border-green-400 ring-2 ring-green-100' :
                    status === 'just_ended' ? 'border-orange-400 ring-2 ring-orange-100' :
                    status === 'soon' ? 'border-amber-400' :
                    'border-purple-100'
                  }`}
                >
                  <div className="p-5">
                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                      {/* Time Column */}
                      <div className="flex-shrink-0 md:w-32 text-center md:text-left">
                        <div className="text-lg font-bold text-slate-800">
                          {formatTime(session.time_start)}
                        </div>
                        <div className="text-sm text-slate-500">
                          to {formatTime(session.time_end)}
                        </div>
                        <div className="mt-2">
                          {getStatusBadge(status)}
                        </div>
                      </div>

                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-slate-800 mb-1 leading-tight">
                          {session.title}
                        </h3>
                        {session.speakers && (
                          <p className="text-purple-600 text-sm mb-2 font-medium">
                            {session.speakers}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
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
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                              {session.track}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Headcount Section */}
                      <div className="flex-shrink-0 md:w-56">
                        {isEditing ? (
                          <div className="bg-purple-50 rounded-xl p-3 space-y-3 border border-purple-200">
                            <div className="flex gap-1">
                              <button
                                onClick={() => setEditMode('percentage')}
                                className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                                  editMode === 'percentage'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-white text-slate-600 hover:bg-purple-100 border border-purple-200'
                                }`}
                              >
                                % Full
                              </button>
                              <button
                                onClick={() => setEditMode('exact')}
                                className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                                  editMode === 'exact'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-white text-slate-600 hover:bg-purple-100 border border-purple-200'
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
                                className="w-full px-3 py-2 bg-white border-2 border-purple-200 rounded-lg text-slate-800 text-center text-lg font-bold focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-500"
                                autoFocus
                              />
                              {editMode === 'percentage' && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                              )}
                            </div>
                            {editMode === 'percentage' && editValue && session.room_capacity && (
                              <div className="text-center text-xs text-slate-500">
                                Approx. {Math.round((parseInt(editValue) / 100) * session.room_capacity)} people
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveHeadcount(session.id)}
                                disabled={saving}
                                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg font-medium transition disabled:opacity-50 shadow-lg shadow-green-200"
                              >
                                {saving ? '...' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-lg font-medium transition border border-slate-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditing(session)}
                            className="w-full bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 border-2 border-dashed border-purple-200 hover:border-purple-400 rounded-xl p-4 text-center transition-all group"
                          >
                            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Headcount</div>
                            {session.headcount_percentage !== null && session.headcount_percentage !== undefined ? (
                              <div className="text-2xl font-bold text-purple-600">
                                {session.headcount_percentage}%
                                <span className="text-sm font-normal text-slate-500 ml-1">full</span>
                              </div>
                            ) : session.headcount !== null && session.headcount !== undefined ? (
                              <div className="text-2xl font-bold text-purple-600">
                                {session.headcount}
                                <span className="text-sm font-normal text-slate-500 ml-1">people</span>
                              </div>
                            ) : (
                              <div className="text-slate-400 flex items-center justify-center gap-2">
                                <span>Tap to add</span>
                                <svg className="w-4 h-4 group-hover:text-purple-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      </div>

      {/* Moderator Section Link */}
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="bg-white rounded-2xl shadow-lg border border-purple-100 p-6 text-center">
          <p className="text-slate-600 mb-4">Are you a moderator?</p>
          <a
            href="/moderator"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Go to Moderator Section
          </a>
        </div>
      </div>

      <Footer />
    </div>
  )
}
