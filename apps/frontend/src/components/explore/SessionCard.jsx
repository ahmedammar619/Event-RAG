export default function SessionCard({ session, reasoning, relevanceScore, rank }) {
  if (!session) return null

  const formatTime = (time) => {
    if (!time) return ''
    // Handle different time formats
    const match = time.match(/(\d{2}):(\d{2})/)
    if (!match) return time
    const hours = parseInt(match[1])
    const minutes = match[2]
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
    return `${displayHours}:${minutes} ${period}`
  }

  const formatDate = (date) => {
    if (!date) return ''
    const d = new Date(date)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const relevancePercent = relevanceScore ? Math.round(parseFloat(relevanceScore) * 100) : null

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
      <div className="p-6">
        {/* Header with Rank and Relevance */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {rank && (
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-semibold text-sm">
                #{rank}
              </span>
            )}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 leading-tight">
                {session.title}
              </h3>
              {session.track && (
                <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                  {session.track}
                </span>
              )}
            </div>
          </div>
          {relevancePercent && (
            <div className="text-right">
              <div className="text-sm font-medium text-purple-600">{relevancePercent}% match</div>
              <div className="w-16 h-1.5 bg-slate-200 rounded-full mt-1">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${relevancePercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Session Details */}
        <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-4">
          {session.date && (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(session.date)}
            </div>
          )}
          {session.time_start && (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTime(session.time_start)} - {formatTime(session.time_end)}
            </div>
          )}
          {session.room && (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {session.room}
            </div>
          )}
        </div>

        {/* Speakers */}
        {session.speakers && (
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-sm text-slate-700">{session.speakers}</span>
          </div>
        )}

        {/* AI Reasoning */}
        {reasoning && (
          <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-purple-700 mb-1">Why this session?</p>
                <p className="text-sm text-purple-900">{reasoning}</p>
              </div>
            </div>
          </div>
        )}

        {/* Description Preview */}
        {session.description_preview && !reasoning && (
          <p className="text-sm text-slate-600 mt-4 line-clamp-3">
            {session.description_preview}...
          </p>
        )}
      </div>
    </div>
  )
}
