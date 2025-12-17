import { useState, useEffect } from 'react'
import { aiService } from '../../services/api'
import { useToast } from '../../context/ToastContext'

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

  const handleSettingChange = async (settingKey, value, apiCall) => {
    setSaving(true)
    try {
      await apiCall(value)
      setSettings({ ...settings, [settingKey]: value })
      toast.success('Setting updated')
    } catch (err) {
      toast.error('Failed to update setting')
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

      {/* Settings Table */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Configuration</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-medium text-slate-600">Setting</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">Description</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">Value</th>
              </tr>
            </thead>
            <tbody>
              {/* Search Mode */}
              <tr className="border-b border-slate-100">
                <td className="py-4 px-4 font-medium text-slate-800">Search Mode</td>
                <td className="py-4 px-4 text-sm text-slate-600">
                  <strong>Direct:</strong> Pure vector search (~400ms)<br/>
                  <strong>Smart:</strong> LLM parses query + filters (~800ms)
                </td>
                <td className="py-4 px-4">
                  <select
                    value={settings.search_mode}
                    onChange={(e) => handleSettingChange('search_mode', e.target.value, aiService.setSearchMode)}
                    disabled={saving}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="direct">Direct Vector</option>
                    <option value="smart">Smart Hybrid</option>
                  </select>
                </td>
              </tr>

              {/* Reasoning Mode */}
              <tr className="border-b border-slate-100">
                <td className="py-4 px-4 font-medium text-slate-800">Reasoning Mode</td>
                <td className="py-4 px-4 text-sm text-slate-600">
                  <strong>Full:</strong> AI generates explanations for each result<br/>
                  <strong>Embedding Only:</strong> No AI reasoning, just similarity scores
                </td>
                <td className="py-4 px-4">
                  <select
                    value={settings.reasoning_mode}
                    onChange={(e) => handleSettingChange('reasoning_mode', e.target.value, aiService.setReasoningMode)}
                    disabled={saving}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="full">Full AI Reasoning</option>
                    <option value="embedding_only">Embedding Only (No AI)</option>
                  </select>
                </td>
              </tr>

              {/* LLM Model */}
              <tr className="border-b border-slate-100">
                <td className="py-4 px-4 font-medium text-slate-800">LLM Model</td>
                <td className="py-4 px-4 text-sm text-slate-600">
                  <strong>gemma3:270m:</strong> Fast, good quality (~3-5s)<br/>
                  <strong>gemma3-4b:</strong> Better quality, slower (~10-15s)
                </td>
                <td className="py-4 px-4">
                  <select
                    value={settings.llm_model}
                    onChange={(e) => handleSettingChange('llm_model', e.target.value, aiService.setLlmModel)}
                    disabled={saving || settings.reasoning_mode === 'embedding_only'}
                    className={`px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${settings.reasoning_mode === 'embedding_only' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <option value="gemma3:270m">Gemma 3 (270M) - Fast</option>
                    <option value="gemma3-4b">Gemma 3 (4B) - Quality</option>
                  </select>
                </td>
              </tr>

              {/* Default Result Count */}
              <tr className="border-b border-slate-100">
                <td className="py-4 px-4 font-medium text-slate-800">Default Results</td>
                <td className="py-4 px-4 text-sm text-slate-600">
                  Number of results to return in initial search
                </td>
                <td className="py-4 px-4">
                  <div className="flex gap-2">
                    {[5, 10, 15, 20].map(count => (
                      <button
                        key={count}
                        onClick={() => handleSettingChange('default_result_count', count.toString(), aiService.setResultCount)}
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
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Cost Optimization Tips</p>
            <ul className="list-disc ml-4 space-y-1">
              <li><strong>Embedding Only mode</strong> has zero LLM costs - great for high traffic</li>
              <li><strong>Direct search</strong> is faster and doesn't use LLM for query parsing</li>
              <li><strong>Gemma 270M</strong> is significantly cheaper than 4B model</li>
              <li>LLM reasoning only runs when users explicitly request it after seeing results</li>
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
