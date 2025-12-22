import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVisitor } from '../../context/VisitorContext'
import { useToast } from '../../context/ToastContext'
import { aiService } from '../../services/api'
import Header from '../../components/common/Header'
import Footer from '../../components/common/Footer'
import SessionCard from '../../components/explore/SessionCard'
import ResultCountSelector from '../../components/explore/ResultCountSelector'

const EXAMPLE_QUERIES = [
  "I'm a convert, what sessions are best for me?",
  "Sessions about family and parenting",
  "I'm struggling with my faith",
  "Sessions by Dr. Haifaa Younis",
  "Arabic language sessions"
]

// AI Assistant Icon (friendly robot face)
const RobotIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    {/* Robot head */}
    <rect x="4" y="6" width="16" height="14" rx="3" />
    {/* Antenna */}
    <line x1="12" y1="6" x2="12" y2="2" />
    <circle cx="12" cy="2" r="1" fill="currentColor" />
    {/* Eyes */}
    <circle cx="9" cy="12" r="1.5" fill="currentColor" />
    <circle cx="15" cy="12" r="1.5" fill="currentColor" />
    {/* Mouth - friendly smile */}
    <path d="M9 16h6" strokeLinecap="round" />
    {/* Ear pieces */}
    <rect x="1" y="10" width="3" height="4" rx="1" fill="currentColor" />
    <rect x="20" y="10" width="3" height="4" rx="1" fill="currentColor" />
  </svg>
)

// Generate a unique session ID for analytics tracking
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('explore_session_id')
  if (!sessionId) {
    sessionId = `ses_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('explore_session_id', sessionId)
  }
  return sessionId
}

export default function Explore() {
  const navigate = useNavigate()
  const toast = useToast()
  const { visitor, isAuthenticated, loading: authLoading, logout } = useVisitor()

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [generatingReasoning, setGeneratingReasoning] = useState(false)
  const [selectedCount, setSelectedCount] = useState(null)
  const [recommendations, setRecommendations] = useState(null)
  const [reasoningMode, setReasoningMode] = useState('full')
  const [sessionId] = useState(getSessionId)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/visitor/login')
    }
  }, [authLoading, isAuthenticated, navigate])

  const handleSearch = async (e) => {
    e?.preventDefault()
    if (!query.trim()) return

    setSearching(true)
    setSearchResults(null)
    setSelectedCount(null)
    setRecommendations(null)

    try {
      const response = await aiService.search(query.trim(), sessionId)
      const results = response.data.data
      setSearchResults(results)

      if (results.reasoning_mode === 'embedding_only' || reasoningMode === 'embedding_only') {
        setReasoningMode('embedding_only')
        const defaultCount = Math.min(5, results.total_matches)
        const directResults = results.results.slice(0, defaultCount).map(r => ({
          session: r.session,
          relevance_score: r.relevance_score,
          reasoning: null
        }))
        setSelectedCount(defaultCount)
        setRecommendations(directResults)
      }
    } catch (err) {
      toast.error('Search failed. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  const handleExampleClick = (example) => {
    setQuery(example)
  }

  const handleCountSelect = async (count) => {
    setSelectedCount(count)
    setGeneratingReasoning(true)

    const sessionsToAnalyze = searchResults.results.slice(0, count)
    const sessionIds = sessionsToAnalyze.map(r => r.session.id)

    try {
      const response = await aiService.getReasoning(query, sessionIds)
      setRecommendations(response.data.data.recommendations)
    } catch (err) {
      toast.error('Failed to generate recommendations. Showing results without AI reasoning.')
      setRecommendations(sessionsToAnalyze)
    } finally {
      setGeneratingReasoning(false)
    }
  }

  const handleReset = () => {
    setQuery('')
    setSearchResults(null)
    setSelectedCount(null)
    setRecommendations(null)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-50 to-white">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4 animate-pulse">
            <RobotIcon className="w-8 h-8 text-purple-600" />
          </div>
          <p className="text-slate-600">Loading AI Assistant...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-purple-50 via-white to-purple-50">
      <Header />

      <div className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {/* AI Assistant Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl mb-4 shadow-lg">
            <RobotIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Session Finder
          </h1>
          <p className="text-slate-600 max-w-md mx-auto">
            Smart search finds relevant sessions, then AI explains why they match your interests
          </p>
          {visitor && (
            <p className="text-sm text-slate-500 mt-3">
              Welcome, {visitor.name}! <button onClick={logout} className="text-purple-600 hover:underline ml-1">Logout</button>
            </p>
          )}
        </div>

        {/* AI Search Input */}
        <div className="bg-white rounded-2xl shadow-xl border border-purple-100 p-6 mb-8 relative overflow-hidden">
          {/* Decorative AI sparkles */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-100 to-transparent rounded-bl-full opacity-50"></div>

          <div className="relative">
            <form onSubmit={handleSearch}>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    className="w-full px-4 py-4 pr-12 rounded-xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none text-lg transition-all"
                    placeholder="Describe what you're looking for..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    disabled={searching || generatingReasoning}
                  />
                  {/* <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg> */}
                </div>
                <button
                  type="submit"
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-purple-200 flex items-center gap-2"
                  disabled={!query.trim() || searching || generatingReasoning}
                >
                  {searching ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Searching</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>Start</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Example Queries */}
            {!searchResults && !recommendations && (
              <div className="mt-5 flex flex-col items-center justify-center">
                <p className="text-sm text-slate-500 mb-3">
                  Try searching for:
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {EXAMPLE_QUERIES.map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleExampleClick(example)}
                      className="px-4 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 rounded-full text-sm hover:from-purple-100 hover:to-indigo-100 transition-all border border-purple-100"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search Results */}
        {searchResults && !selectedCount && (
          <>
            <div className="bg-white rounded-2xl shadow-xl border border-purple-100 p-6 mb-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl mb-4 shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-800">
                  Found {searchResults.total_matches} Matching Sessions!
                </h2>
                <p className="text-slate-500 mt-2 flex items-center justify-center gap-2">
                  <RobotIcon className="w-5 h-5 text-purple-500" />
                  Want AI to explain why these match your interests?
                </p>
                {searchResults.language_detected === 'arabic' && (
                  <p className="text-sm text-purple-600 mt-2">
                    🌍 Your Arabic query was translated for better matching
                  </p>
                )}
              </div>

              <ResultCountSelector
                totalResults={searchResults.total_matches}
                onSelect={handleCountSelect}
                disabled={generatingReasoning}
              />
            </div>

            {/* Preview Results */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                  <span className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center text-sm">
                    {searchResults.total_matches}
                  </span>
                  Sessions Found
                </h3>
                <button
                  onClick={handleReset}
                  className="text-purple-600 hover:underline text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  New Search
                </button>
              </div>
              {searchResults.results.map((result, idx) => (
                <SessionCard
                  key={result.session?.id || idx}
                  session={result.session}
                  reasoning={null}
                  relevanceScore={result.relevance_score}
                  rank={idx + 1}
                  compact={true}
                />
              ))}
            </div>
          </>
        )}

        {/* AI Thinking State */}
        {generatingReasoning && (
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl shadow-xl border border-purple-200 p-8 mb-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-lg mb-5">
                <div className="relative">
                  <RobotIcon className="w-10 h-10 text-purple-600 animate-pulse" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-ping"></div>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">AI is Analyzing Sessions...</h3>
              <p className="text-slate-600 mb-4">Understanding why each session matches your interests</p>
              <div className="flex items-center justify-center gap-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* AI Recommendations */}
        {recommendations && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <RobotIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    {reasoningMode === 'embedding_only' ? 'Top Matches' : 'AI Explanations'}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {reasoningMode === 'embedding_only'
                      ? 'Ranked by relevance'
                      : 'AI explains why each session matches your query'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="text-purple-600 hover:underline text-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                New Search
              </button>
            </div>

            {recommendations.map((rec, idx) => (
              <SessionCard
                key={rec.session?.id || idx}
                session={rec.session}
                reasoning={rec.reasoning}
                relevanceScore={rec.relevance_score}
                rank={idx + 1}
              />
            ))}

            {reasoningMode === 'embedding_only' && searchResults && recommendations.length < searchResults.total_matches && (
              <div className="text-center">
                <button
                  onClick={() => {
                    const moreCount = Math.min(recommendations.length + 5, searchResults.total_matches)
                    const moreResults = searchResults.results.slice(0, moreCount).map(r => ({
                      session: r.session,
                      relevance_score: r.relevance_score,
                      reasoning: null
                    }))
                    setRecommendations(moreResults)
                    setSelectedCount(moreCount)
                  }}
                  className="px-6 py-3 bg-white border-2 border-purple-200 text-purple-600 rounded-xl hover:bg-purple-50 transition-all font-medium"
                >
                  Show More ({searchResults.total_matches - recommendations.length} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
