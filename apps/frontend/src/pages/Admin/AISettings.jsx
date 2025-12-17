import { useState, useEffect } from 'react'
import { aiService } from '../../services/api'
import { useToast } from '../../context/ToastContext'

const SEARCH_PIPELINES = [
  {
    id: 'smart_search',
    name: 'Smart Search',
    subtitle: 'Fast & Free',
    description: 'Pure semantic vector search. No AI costs.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    flow: ['Query', 'Embedding', 'Vector Search', 'Results'],
    settings: { search_mode: 'direct', reasoning_mode: 'embedding_only' },
    speed: '~400ms',
    cost: 'Free',
    color: 'emerald'
  },
  {
    id: 'search_plus_ai',
    name: 'Search + AI',
    subtitle: 'Balanced',
    description: 'Vector search, then AI explains why each result matches.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    flow: ['Query', 'Embedding', 'Vector Search', 'AI Reasoning'],
    settings: { search_mode: 'direct', reasoning_mode: 'full' },
    speed: '~3-5s',
    cost: '1 LLM call',
    color: 'purple'
  },
  {
    id: 'ai_search_ai',
    name: 'AI + Search + AI',
    subtitle: 'Most Accurate',
    description: 'AI understands query intent, filters results, then explains matches.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    flow: ['Query', 'AI Parse', 'Filter + Search', 'AI Reasoning'],
    settings: { search_mode: 'smart', reasoning_mode: 'full' },
    speed: '~5-8s',
    cost: '2 LLM calls',
    color: 'amber'
  }
]

const LLM_MODELS = [
  { id: 'gemma3:270m', name: 'Gemma 3 (270M)', description: 'Fast responses', speed: '~3-5s' },
  { id: 'gemma3-4b', name: 'Gemma 3 (4B)', description: 'Better quality', speed: '~10-15s' }
]

export default function AISettings() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    search_mode: 'direct',
    default_result_count: '5',
    llm_model: 'gemma3:270m',
    reasoning_mode: 'full'
  })
  const [health, setHealth] = useState(null)
  const [analytics, setAnalytics] = useState(null)

  useEffect(() => {
    fetchSettings()
    fetchHealth()
    fetchAnalytics()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await aiService.getSettings()
      setSettings(response.data.data)
    } catch (err) {
      toast.error('Failed to load AI settings')
    } finally {
      setLoading(false)
    }
  }

  const fetchHealth = async () => {
    try {
      const response = await aiService.getHealth()
      setHealth(response.data.data)
    } catch (err) {
      setHealth({ status: 'error', error: 'Failed to connect' })
    }
  }

  const fetchAnalytics = async () => {
    try {
      const response = await aiService.getAnalytics(7)
      setAnalytics(response.data.data)
    } catch (err) {
      // Analytics might not be available
    }
  }

  const getCurrentPipeline = () => {
    return SEARCH_PIPELINES.find(p =>
      p.settings.search_mode === settings.search_mode &&
      p.settings.reasoning_mode === settings.reasoning_mode
    ) || SEARCH_PIPELINES[1] // Default to Search + AI
  }

  const handlePipelineChange = async (pipeline) => {
    setSaving(true)
    try {
      // Update both settings
      await aiService.setSearchMode(pipeline.settings.search_mode)
      await aiService.setReasoningMode(pipeline.settings.reasoning_mode)
      setSettings({
        ...settings,
        search_mode: pipeline.settings.search_mode,
        reasoning_mode: pipeline.settings.reasoning_mode
      })
      toast.success(`Switched to ${pipeline.name}`)
    } catch (err) {
      toast.error('Failed to update pipeline')
    } finally {
      setSaving(false)
    }
  }

  const handleModelChange = async (modelId) => {
    setSaving(true)
    try {
      await aiService.setLlmModel(modelId)
      setSettings({ ...settings, llm_model: modelId })
      toast.success('Model updated')
    } catch (err) {
      toast.error('Failed to update model')
    } finally {
      setSaving(false)
    }
  }

  const handleResultCountChange = async (count) => {
    setSaving(true)
    try {
      await aiService.setResultCount(count)
      setSettings({ ...settings, default_result_count: count.toString() })
      toast.success('Result count updated')
    } catch (err) {
      toast.error('Failed to update')
    } finally {
      setSaving(false)
    }
  }

  const getColorClasses = (color, isSelected) => {
    const colors = {
      emerald: {
        selected: 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500',
        hover: 'hover:border-emerald-300 hover:bg-emerald-50/50',
        text: 'text-emerald-600',
        badge: 'bg-emerald-100 text-emerald-700'
      },
      purple: {
        selected: 'bg-purple-50 border-purple-500 ring-2 ring-purple-500',
        hover: 'hover:border-purple-300 hover:bg-purple-50/50',
        text: 'text-purple-600',
        badge: 'bg-purple-100 text-purple-700'
      },
      amber: {
        selected: 'bg-amber-50 border-amber-500 ring-2 ring-amber-500',
        hover: 'hover:border-amber-300 hover:bg-amber-50/50',
        text: 'text-amber-600',
        badge: 'bg-amber-100 text-amber-700'
      }
    }
    return colors[color] || colors.purple
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    )
  }

  const currentPipeline = getCurrentPipeline()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">AI Settings</h1>
        <p className="text-slate-500 mt-1">Configure how the AI session finder works</p>
      </div>

      {/* Health Status - Compact */}
      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${health?.status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="font-medium text-slate-700">System Status:</span>
          <span className={health?.status === 'ok' ? 'text-green-600' : 'text-red-600'}>
            {health?.status === 'ok' ? 'All services operational' : 'Issues detected'}
          </span>
        </div>
        {health?.services?.embedding && (
          <span className="text-sm text-slate-500">
            Embeddings: {health.services.embedding.dimensions}d
          </span>
        )}
      </div>

      {/* Search Pipeline Selection */}
      <div className="card">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-800">Search Pipeline</h2>
          <p className="text-sm text-slate-500 mt-1">Choose how visitors search for sessions</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {SEARCH_PIPELINES.map((pipeline) => {
            const isSelected = currentPipeline.id === pipeline.id
            const colors = getColorClasses(pipeline.color, isSelected)

            return (
              <button
                key={pipeline.id}
                onClick={() => handlePipelineChange(pipeline)}
                disabled={saving}
                className={`relative p-6 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? colors.selected
                    : `border-slate-200 ${colors.hover}`
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {/* Selected Badge */}
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <svg className={`w-6 h-6 ${colors.text}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}

                {/* Icon */}
                <div className={`mb-4 ${colors.text}`}>
                  {pipeline.icon}
                </div>

                {/* Title & Subtitle */}
                <h3 className="text-lg font-semibold text-slate-800">{pipeline.name}</h3>
                <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${colors.badge}`}>
                  {pipeline.subtitle}
                </span>

                {/* Description */}
                <p className="mt-3 text-sm text-slate-600">{pipeline.description}</p>

                {/* Flow Diagram */}
                <div className="mt-4 flex items-center gap-1 text-xs text-slate-400">
                  {pipeline.flow.map((step, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="px-2 py-1 bg-slate-100 rounded">{step}</span>
                      {i < pipeline.flow.length - 1 && <span>→</span>}
                    </span>
                  ))}
                </div>

                {/* Stats */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Speed: <span className="font-medium text-slate-700">{pipeline.speed}</span></span>
                  <span className="text-slate-500">Cost: <span className="font-medium text-slate-700">{pipeline.cost}</span></span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* LLM Model Selection - Only show if AI is enabled */}
      {settings.reasoning_mode === 'full' && (
        <div className="card">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-800">AI Model</h2>
            <p className="text-sm text-slate-500 mt-1">Choose the LLM model for reasoning</p>
          </div>

          <div className="flex gap-4">
            {LLM_MODELS.map((model) => (
              <button
                key={model.id}
                onClick={() => handleModelChange(model.id)}
                disabled={saving}
                className={`flex-1 p-4 rounded-xl border-2 text-left transition-all ${
                  settings.llm_model === model.id
                    ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500'
                    : 'border-slate-200 hover:border-purple-300'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">{model.name}</h3>
                    <p className="text-sm text-slate-500">{model.description}</p>
                  </div>
                  <span className="text-xs text-slate-400">{model.speed}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Default Results Count */}
      <div className="card">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-800">Default Results</h2>
          <p className="text-sm text-slate-500 mt-1">Number of sessions to show initially</p>
        </div>

        <div className="flex gap-3">
          {[5, 10, 15, 20].map(count => (
            <button
              key={count}
              onClick={() => handleResultCountChange(count)}
              disabled={saving}
              className={`px-6 py-3 rounded-xl font-medium text-lg transition-all ${
                parseInt(settings.default_result_count) === count
                  ? 'bg-slate-800 text-white shadow-lg'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Analytics Summary */}
      {analytics?.totals && (
        <div className="card">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-800">Last 7 Days</h2>
            <p className="text-sm text-slate-500 mt-1">Search analytics overview</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-2xl font-bold text-slate-800">{analytics.totals.total_searches || 0}</p>
              <p className="text-sm text-slate-500">Total Searches</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-2xl font-bold text-slate-800">{analytics.totals.unique_visitors || 0}</p>
              <p className="text-sm text-slate-500">Unique Visitors</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-2xl font-bold text-slate-800">{analytics.totals.avg_search_ms || 0}ms</p>
              <p className="text-sm text-slate-500">Avg Search Time</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-2xl font-bold text-slate-800">{analytics.totals.total_reasoning_requests || 0}</p>
              <p className="text-sm text-slate-500">AI Reasoning Requests</p>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Understanding the Pipelines</h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li><strong>Smart Search:</strong> Best for high traffic. Pure vector similarity with zero AI costs.</li>
              <li><strong>Search + AI:</strong> Balanced choice. Fast search, then AI explains each result.</li>
              <li><strong>AI + Search + AI:</strong> Most accurate for complex queries like "morning sessions by Dr. Haifaa about family".</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Saving Indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          Saving...
        </div>
      )}
    </div>
  )
}
