import { useState } from 'react'
import { syncService } from '../../services/api'
import { useToast } from '../../context/ToastContext'

export default function Sync() {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [preview, setPreview] = useState(null)
  const [logs, setLogs] = useState([])
  const [showLogs, setShowLogs] = useState(false)
  const [debugData, setDebugData] = useState(null)
  const [debugLoading, setDebugLoading] = useState(false)
  const [matchCheck, setMatchCheck] = useState(null)
  const [matchLoading, setMatchLoading] = useState(false)

  const loadPreview = async () => {
    setLoading(true)
    setPreview(null)
    try {
      const response = await syncService.preview()
      setPreview(response.data.data)
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to load preview')
    } finally {
      setLoading(false)
    }
  }

  const applyChanges = async () => {
    if (!preview?.changes?.length) return

    if (!confirm(`Are you sure you want to apply ${preview.changes.length} changes?`)) return

    setApplying(true)
    try {
      const response = await syncService.apply(preview.changes)
      const result = response.data.data
      toast.success(`Sync complete: ${result.applied} updated, ${result.failed} failed`)
      setPreview(null)
      loadLogs()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to apply changes')
    } finally {
      setApplying(false)
    }
  }

  const loadLogs = async () => {
    try {
      const response = await syncService.getLogs()
      setLogs(response.data.data || [])
      setShowLogs(true)
    } catch (err) {
      console.error('Failed to load logs:', err)
    }
  }

  const loadDebug = async (date = '2025-12-27') => {
    setDebugLoading(true)
    try {
      const response = await syncService.debug(date)
      setDebugData(response.data.data)
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to load debug data')
    } finally {
      setDebugLoading(false)
    }
  }

  const loadMatchCheck = async () => {
    setMatchLoading(true)
    try {
      const response = await syncService.matchCheck()
      setMatchCheck(response.data.data)
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to check matches')
    } finally {
      setMatchLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sync Sessions</h1>
          <p>Sync session data from Google Sheets</p>
        </div>
      </div>

      {/* Source Info */}
      <div className="card mb-4">
        <h3 className="text-lg font-semibold mb-3">Data Source</h3>
        <div className="flex items-center gap-3 text-sm">
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">Google Sheets</span>
          <span className="text-slate-500">→</span>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">Main Database</span>
        </div>
        <p className="text-sm text-slate-500 mt-3">
          Syncs speaker names from the ISNA Convention schedule spreadsheet to your sessions database.
          Matching is done by room + time slot.
        </p>
      </div>

      {/* Actions */}
      <div className="card mb-4">
        <div className="flex flex-wrap gap-3">
          <button
            className="btn btn-primary"
            onClick={loadPreview}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Preview Sync Changes'}
          </button>
          <button
            className="btn btn-outline"
            onClick={loadLogs}
          >
            View Sync History
          </button>
          <button
            className="btn btn-outline"
            onClick={() => loadDebug()}
            disabled={debugLoading}
          >
            {debugLoading ? 'Loading...' : 'Debug: View Parsed Data'}
          </button>
          <button
            className="btn btn-primary"
            onClick={loadMatchCheck}
            disabled={matchLoading}
          >
            {matchLoading ? 'Checking...' : 'Check All 59 Sessions Match'}
          </button>
        </div>
      </div>

      {/* Preview Results */}
      {preview && (
        <div className="card mb-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Sync Preview</h3>
            {preview.changes?.length > 0 && (
              <button
                className="btn btn-primary"
                onClick={applyChanges}
                disabled={applying}
              >
                {applying ? 'Applying...' : `Apply ${preview.changes.length} Changes`}
              </button>
            )}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-slate-700">{preview.summary?.totalSheetSessions || 0}</div>
              <div className="text-sm text-slate-500">Sessions in Sheet</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">{preview.summary?.changesFound || 0}</div>
              <div className="text-sm text-blue-600">Changes Found</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-700">{preview.summary?.errors || 0}</div>
              <div className="text-sm text-red-600">Errors</div>
            </div>
          </div>

          {/* Changes List */}
          {preview.changes?.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-medium text-slate-700">Changes to Apply:</h4>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {preview.changes.map((change, idx) => (
                  <div key={idx} className="border rounded-lg p-3 bg-white">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-slate-800">{change.dbSession?.name}</div>
                        <div className="text-xs text-slate-500">
                          {change.dbSession?.room} • {change.dbSession?.time}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                        {change.matchType}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {change.changes?.map((c, i) => (
                        <div key={i} className="text-sm flex items-center gap-2">
                          <span className="font-medium text-slate-600">{c.field}:</span>
                          <span className="text-red-600 line-through">{c.old || '(empty)'}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-green-600">{c.new}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <div className="text-4xl mb-2">✓</div>
              <div>No changes needed - everything is in sync!</div>
            </div>
          )}

          {/* Logs */}
          {preview.logs?.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">
                View Sync Logs ({preview.logs.length} entries)
              </summary>
              <div className="mt-2 max-h-64 overflow-y-auto bg-slate-50 rounded-lg p-3 text-xs font-mono">
                {preview.logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`py-1 ${
                      log.type === 'error' ? 'text-red-600' :
                      log.type === 'warning' ? 'text-amber-600' :
                      log.type === 'success' ? 'text-green-600' :
                      'text-slate-600'
                    }`}
                  >
                    [{log.type}] {log.message}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Sync History */}
      {showLogs && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Sync History</h3>
            <button
              className="text-slate-500 hover:text-slate-700"
              onClick={() => setShowLogs(false)}
            >
              ✕
            </button>
          </div>
          {logs.length === 0 ? (
            <p className="text-slate-500 text-center py-4">No sync history yet</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {logs.map((log, idx) => (
                <div key={idx} className="border rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{log.sync_type}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600">
                    {Array.isArray(log.sync_data) ? (
                      <div>
                        {log.sync_data.filter(l => l.status === 'success').length} successful,
                        {' '}{log.sync_data.filter(l => l.status === 'failed').length} failed
                      </div>
                    ) : (
                      <pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.sync_data, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Match Check Results */}
      {matchCheck && (
        <div className="card mb-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Session Match Check</h3>
            <button className="text-slate-500 hover:text-slate-700" onClick={() => setMatchCheck(null)}>✕</button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-slate-700">{matchCheck.summary?.totalDbSessions || 0}</div>
              <div className="text-sm text-slate-500">DB Sessions</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-700">{matchCheck.summary?.matched || 0}</div>
              <div className="text-sm text-green-600">Matched</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-700">{matchCheck.summary?.unmatched || 0}</div>
              <div className="text-sm text-red-600">Unmatched DB</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-amber-700">{matchCheck.summary?.totalSheetSessions || 0}</div>
              <div className="text-sm text-amber-600">Sheet Sessions</div>
            </div>
          </div>

          {/* Per-sheet counts */}
          {matchCheck.summary?.sheetCounts && (
            <div className="bg-slate-100 rounded-lg p-3 mb-6 text-sm">
              <strong>Per-Sheet Breakdown:</strong>
              {Object.entries(matchCheck.summary.sheetCounts).map(([date, count]) => (
                <span key={date} className="ml-4">
                  {date}: <span className="font-medium">{count}</span>
                </span>
              ))}
            </div>
          )}

          {/* Matched Sessions */}
          <details className="mb-4" open>
            <summary className="cursor-pointer font-medium text-green-700 mb-2">
              Matched Sessions ({matchCheck.matched?.length || 0})
            </summary>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {matchCheck.matched?.map((m, idx) => (
                <div key={idx} className="border border-green-200 rounded-lg p-3 bg-green-50 text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-slate-800">{m.dbName}</div>
                      <div className="text-xs text-slate-500">{m.dbRoom} • {m.dbTime} • {m.dbDate}</div>
                    </div>
                    <span className="px-2 py-1 bg-green-200 text-green-800 rounded text-xs">Matched</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">DB Speaker:</span> {m.dbSpeaker || '(none)'}
                    </div>
                    <div>
                      <span className="text-slate-500">Sheet Speaker:</span> {m.sheetSpeaker || '(none)'}
                    </div>
                    {m.sheetModerator && (
                      <div className="col-span-2">
                        <span className="text-slate-500">Sheet Moderator:</span> {m.sheetModerator}
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500">DB Time:</span> {m.dbTime}
                    </div>
                    <div>
                      <span className="text-slate-500">Sheet Time:</span> {m.sheetTime || '(none)'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </details>

          {/* Unmatched DB Sessions */}
          {matchCheck.unmatched?.length > 0 && (
            <details className="mb-4" open>
              <summary className="cursor-pointer font-medium text-red-700 mb-2">
                Unmatched DB Sessions ({matchCheck.unmatched?.length || 0})
              </summary>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {matchCheck.unmatched?.map((m, idx) => (
                  <div key={idx} className="border border-red-200 rounded-lg p-3 bg-red-50 text-sm">
                    <div className="font-medium text-slate-800">{m.dbName}</div>
                    <div className="text-xs text-slate-500">{m.dbRoom} • {m.dbTime} • {m.dbDate}</div>
                    <div className="text-xs text-slate-500 mt-1">Speaker: {m.dbSpeaker || '(none)'}</div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Unmatched Sheet Sessions */}
          {matchCheck.unmatchedSheetSessions?.length > 0 && (
            <details className="mb-4">
              <summary className="cursor-pointer font-medium text-amber-700 mb-2">
                Unmatched Sheet Sessions ({matchCheck.unmatchedSheetSessions?.length || 0})
              </summary>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {matchCheck.unmatchedSheetSessions?.map((s, idx) => (
                  <div key={idx} className="border border-amber-200 rounded-lg p-3 bg-amber-50 text-sm">
                    <div className="font-medium text-slate-800">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.room} • {s.time} • {s.date}</div>
                    <div className="text-xs text-slate-500 mt-1">Speaker: {s.speaker || '(none)'}</div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Debug Data */}
      {debugData && (
        <div className="card mb-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Debug: Parsed Sheet Data</h3>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-outline" onClick={() => loadDebug('2025-12-26')}>Fri</button>
              <button className="btn btn-sm btn-outline" onClick={() => loadDebug('2025-12-27')}>Sat</button>
              <button className="btn btn-sm btn-outline" onClick={() => loadDebug('2025-12-28')}>Sun</button>
              <button className="text-slate-500 hover:text-slate-700 ml-2" onClick={() => setDebugData(null)}>✕</button>
            </div>
          </div>

          <div className="text-sm text-slate-600 mb-4">
            <strong>Date:</strong> {debugData.date} | <strong>GID:</strong> {debugData.gid} | <strong>Raw Rows:</strong> {debugData.rawRowCount}
          </div>

          {/* Headers */}
          <details className="mb-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">Sheet Headers (Columns)</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {debugData.headers?.map((h, i) => (
                <span key={i} className="px-2 py-1 bg-slate-100 rounded text-xs">{h || '(empty)'}</span>
              ))}
            </div>
          </details>

          {/* Parsed Sessions */}
          <div>
            <h4 className="font-medium text-slate-700 mb-2">Parsed Sessions (first 20):</h4>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {debugData.parsedSessions?.map((session, idx) => (
                <div key={idx} className="border rounded-lg p-3 bg-slate-50 text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-slate-800">{session.sessionName}</div>
                      <div className="text-xs text-slate-500">{session.room} • {session.time}</div>
                    </div>
                    {session.speaker && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                        Speaker: {session.speaker}
                      </span>
                    )}
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-slate-400">Raw content</summary>
                    <pre className="mt-1 text-xs bg-white p-2 rounded overflow-x-auto whitespace-pre-wrap">{session.rawContent}</pre>
                  </details>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
