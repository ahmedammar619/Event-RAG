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
  "What's happening in the morning?",
  "Sessions by Dr. Haifaa Younis",
  "Arabic language sessions"
]

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
  const [reasoningMode, setReasoningMode] = useState('full') // 'full' or 'embedding_only'
  const [sessionId] = useState(getSessionId) // Stable session ID for this browser session

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

      // Check if we're in embedding_only mode (detected from response or settings)
      // In embedding_only mode, skip the count selection and show results directly
      if (results.reasoning_mode === 'embedding_only' || reasoningMode === 'embedding_only') {
        setReasoningMode('embedding_only')
        // Show top results directly without AI reasoning
        const defaultCount = Math.min(5, results.total_matches)
        const directResults = results.results.slice(0, defaultCount).map(r => ({
          session: r.session,
          relevance_score: r.relevance_score,
          reasoning: null // No AI reasoning in embedding_only mode
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-purple-50 to-white">
      <Header />

      <div className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {/* Welcome Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Session Explorer
          </h1>
          <p className="text-slate-600">
            Ask me anything about the sessions and I'll help you find what's perfect for you
          </p>
          {visitor && (
            <p className="text-sm text-slate-500 mt-2">
              Logged in as {visitor.name} <button onClick={logout} className="text-purple-600 hover:underline ml-2">Logout</button>
            </p>
          )}
        </div>

        {/* Search Input */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-8">
          <form onSubmit={handleSearch}>
            <div className="flex gap-3">
              <input
                type="text"
                className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-lg"
                placeholder="Ask me about sessions..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                disabled={searching || generatingReasoning}
              />
              <button
                type="submit"
                className="px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                disabled={!query.trim() || searching || generatingReasoning}
              >
                {searching ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Searching
                  </span>
                ) : 'Search'}
              </button>
            </div>
          </form>

          {/* Example Queries */}
          {!searchResults && !recommendations && (
            <div className="mt-4">
              <p className="text-sm text-slate-500 mb-2">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_QUERIES.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExampleClick(example)}
                    className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm hover:bg-purple-200 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search Results - Before Count Selection */}
        {searchResults && !selectedCount && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-800">
                Found {searchResults.total_matches} relevant sessions!
              </h2>
              <p className="text-slate-500 mt-1">
                How many would you like me to analyze in detail?
              </p>
              {searchResults.language_detected === 'arabic' && (
                <p className="text-sm text-purple-600 mt-2">
                  Query translated from Arabic for better search results
                </p>
              )}
            </div>

            <ResultCountSelector
              totalResults={searchResults.total_matches}
              onSelect={handleCountSelect}
              disabled={generatingReasoning}
            />
          </div>
        )}

        {/* Loading State for Reasoning */}
        {generatingReasoning && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-lg text-slate-600">Generating personalized recommendations...</p>
            <p className="text-sm text-slate-400 mt-1">This may take a few seconds</p>
          </div>
        )}

        {/* Recommendations with Reasoning */}
        {recommendations && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">
                  {reasoningMode === 'embedding_only' ? 'Top Matching Sessions' : 'Your Personalized Recommendations'}
                </h2>
                {reasoningMode === 'embedding_only' && (
                  <p className="text-sm text-slate-500 mt-1">
                    Ranked by relevance to your search
                  </p>
                )}
              </div>
              <button
                onClick={handleReset}
                className="text-purple-600 hover:underline text-sm"
              >
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

            {/* Show more results option in embedding_only mode */}
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
                  className="px-6 py-2 border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
                >
                  Show More Sessions ({searchResults.total_matches - recommendations.length} remaining)
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
