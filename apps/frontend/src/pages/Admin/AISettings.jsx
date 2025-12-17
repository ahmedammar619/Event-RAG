import { useState, useEffect } from 'react'
import { aiService } from '../../services/api'
import { useToast } from '../../context/ToastContext'

export default function AISettings() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    search_mode: 'direct',
    default_result_count: '5'
  })
  const [health, setHealth] = useState(null)

  useEffect(() => {
    fetchSettings()
    fetchHealth()
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

  const handleModeChange = async (mode) => {
    setSaving(true)
    try {
      await aiService.setSearchMode(mode)
      setSettings({ ...settings, search_mode: mode })
      toast.success(`Search mode changed to ${mode}`)
    } catch (err) {
      toast.error('Failed to update search mode')
    } finally {
      setSaving(false)
    }
  }

  const handleResultCountChange = async (count) => {
    setSaving(true)
    try {
      await aiService.setResultCount(count)
      setSettings({ ...settings, default_result_count: count.toString() })
      toast.success('Default result count updated')
    } catch (err) {
      toast.error('Failed to update result count')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">AI Settings</h1>
        <p className="text-slate-500 mt-1">Configure the AI session finder behavior</p>
      </div>

      {/* Health Status */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Service Status</h2>
        {health ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={`p-4 rounded-lg ${health.status === 'ok' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${health.status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="font-medium">Overall</span>
              </div>
              <p className="text-sm text-slate-600">{health.status === 'ok' ? 'All systems operational' : 'Issues detected'}</p>
            </div>

            {health.services?.embedding && (
              <div className={`p-4 rounded-lg ${health.services.embedding.status === 'ok' ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${health.services.embedding.status === 'ok' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <span className="font-medium">Embeddings</span>
                </div>
                <p className="text-sm text-slate-600">
                  {health.services.embedding.status === 'ok' ? `${health.services.embedding.dimensions} dimensions` : health.services.embedding.error}
                </p>
              </div>
            )}

            {health.services?.language && (
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="font-medium">Language</span>
                </div>
                <p className="text-sm text-slate-600">Detection active</p>
              </div>
            )}

            {health.services?.queryParser && (
              <div className={`p-4 rounded-lg ${health.services.queryParser.status === 'ok' ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${health.services.queryParser.status === 'ok' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <span className="font-medium">Query Parser</span>
                </div>
                <p className="text-sm text-slate-600">{health.services.queryParser.status === 'ok' ? 'Ready' : 'Limited'}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-500">Checking service status...</p>
        )}
      </div>

      {/* Search Mode */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Search Mode</h2>
        <p className="text-slate-500 text-sm mb-4">Choose how the AI processes user queries</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => handleModeChange('direct')}
            disabled={saving}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              settings.search_mode === 'direct'
                ? 'border-purple-500 bg-purple-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-4 h-4 rounded-full border-2 ${
                settings.search_mode === 'direct'
                  ? 'border-purple-500 bg-purple-500'
                  : 'border-slate-300'
              }`}>
                {settings.search_mode === 'direct' && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                  </div>
                )}
              </div>
              <span className="font-semibold">Direct Vector Search</span>
            </div>
            <p className="text-sm text-slate-600 ml-7">
              Faster (~400ms) and cheaper. Best for simple semantic queries like "sessions about spirituality".
            </p>
          </button>

          <button
            onClick={() => handleModeChange('smart')}
            disabled={saving}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              settings.search_mode === 'smart'
                ? 'border-purple-500 bg-purple-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-4 h-4 rounded-full border-2 ${
                settings.search_mode === 'smart'
                  ? 'border-purple-500 bg-purple-500'
                  : 'border-slate-300'
              }`}>
                {settings.search_mode === 'smart' && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                  </div>
                )}
              </div>
              <span className="font-semibold">Smart Hybrid Search</span>
            </div>
            <p className="text-sm text-slate-600 ml-7">
              More accurate (~800ms). Parses queries to extract filters. Best for "morning sessions by Dr. Haifaa about family".
            </p>
          </button>
        </div>
      </div>

      {/* Default Result Count */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Default Results to Return</h2>
        <p className="text-slate-500 text-sm mb-4">How many results to fetch in the initial search</p>

        <div className="flex gap-2">
          {[5, 10, 15, 20].map(count => (
            <button
              key={count}
              onClick={() => handleResultCountChange(count)}
              disabled={saving}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                parseInt(settings.default_result_count) === count
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Cost Optimization</p>
            <p>LLM reasoning is only generated when users explicitly request it after seeing search results. This significantly reduces Railway compute costs while maintaining a great user experience.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
