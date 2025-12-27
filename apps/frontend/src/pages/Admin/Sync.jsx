import { useState } from 'react'
import { syncService } from '../../services/api'
import { useToast } from '../../context/ToastContext'

export default function Sync() {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [applyingField, setApplyingField] = useState(null) // Track which field is being applied
  const [appliedFields, setAppliedFields] = useState({}) // Track applied changes { "sessionId-field": true }
  const [preview, setPreview] = useState(null)
  const [logs, setLogs] = useState([])
  const [showLogs, setShowLogs] = useState(false)
  const [debugData, setDebugData] = useState(null)
  const [debugLoading, setDebugLoading] = useState(false)
  const [matchCheck, setMatchCheck] = useState(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [diagnose, setDiagnose] = useState(null)
  const [diagnoseLoading, setDiagnoseLoading] = useState(false)

  const loadPreview = async () => {
    setLoading(true)
    setPreview(null)
    setAppliedFields({}) // Reset applied fields on new preview
    try {
      const response = await syncService.preview()
      setPreview(response.data.data)
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to load preview')
    } finally {
      setLoading(false)
    }
  }

  // Apply a single field change
  const applyOneChange = async (sessionId, field, value, roomId = null) => {
    const key = `${sessionId}-${field}`
    setApplyingField(key)
    try {
      await syncService.applyOne(sessionId, field, value, roomId)
      setAppliedFields(prev => ({ ...prev, [key]: true }))
      toast.success(`Applied ${field} change`)
    } catch (err) {
      toast.error(err.response?.data?.error?.message || `Failed to apply ${field} change`)
    } finally {
      setApplyingField(null)
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

  const loadDiagnose = async () => {
    setDiagnoseLoading(true)
    try {
      const response = await syncService.diagnose()
      setDiagnose(response.data.data)
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to diagnose')
    } finally {
      setDiagnoseLoading(false)
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
          Syncs session times, rooms, and moderator info from Google Sheets.
          Matching is done by session name. Review each change before applying.
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
            {matchLoading ? 'Checking...' : 'Check All Sessions Match'}
          </button>
          <button
            className="btn btn-outline text-red-600 border-red-300 hover:bg-red-50"
            onClick={loadDiagnose}
            disabled={diagnoseLoading}
          >
            {diagnoseLoading ? 'Diagnosing...' : 'Diagnose Match Issues'}
          </button>
        </div>
      </div>

      {/* Diagnose Results */}
      {diagnose && (
        <div className="card mb-4 border-2 border-red-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-red-700">Diagnosis Report</h3>
            <button className="text-slate-500 hover:text-slate-700" onClick={() => setDiagnose(null)}>✕</button>
          </div>

          <div className="space-y-4">
            {/* Room Comparison */}
            <div className="bg-red-50 rounded-lg p-4">
              <h4 className="font-medium text-red-800 mb-2">Room Name Comparison</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-slate-700 mb-1">DB Rooms ({diagnose.diagnosis?.dbRooms?.length || 0}):</div>
                  <div className="bg-white rounded p-2 max-h-32 overflow-y-auto">
                    {diagnose.diagnosis?.dbRooms?.map((r, i) => (
                      <div key={i} className="text-xs py-0.5 border-b border-slate-100">{r}</div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-slate-700 mb-1">Sheet Rooms ({diagnose.diagnosis?.sheetRoomsExtracted?.length || 0}):</div>
                  <div className="bg-white rounded p-2 max-h-32 overflow-y-auto">
                    {diagnose.diagnosis?.sheetRoomsExtracted?.map((r, i) => (
                      <div key={i} className="text-xs py-0.5 border-b border-slate-100">{r || '(null)'}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Header Analysis */}
            <div className="bg-amber-50 rounded-lg p-4">
              <h4 className="font-medium text-amber-800 mb-2">Sheet Headers ({diagnose.diagnosis?.sheetHeaderCount || 0} columns)</h4>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {diagnose.diagnosis?.sheetHeaders?.map((h, i) => (
                  <div key={i} className="text-xs bg-white rounded p-2 flex justify-between">
                    <span className="truncate flex-1">{h.fullHeader || '(empty)'}</span>
                    <span className="ml-2 px-2 py-0.5 bg-amber-200 rounded text-amber-800">
                      {h.extractedRoom || 'NO ROOM EXTRACTED'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sample Sessions */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Sample DB Sessions</h4>
                <div className="space-y-2">
                  {diagnose.sampleDbSessions?.map((s, i) => (
                    <div key={i} className="text-xs bg-white rounded p-2">
                      <div className="font-medium truncate">{s.name}</div>
                      <div className="text-slate-500">
                        <span className="bg-blue-100 px-1 rounded">{s.room}</span> • {s.time} • {s.date}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-2">Sample Sheet Sessions</h4>
                <div className="space-y-2">
                  {diagnose.sampleSheetSessions?.map((s, i) => (
                    <div key={i} className="text-xs bg-white rounded p-2">
                      <div className="font-medium truncate">{s.name}</div>
                      <div className="text-slate-500">
                        <span className="bg-green-100 px-1 rounded">{s.room || 'null'}</span> • {s.time} • {s.date}
                      </div>
                      <div className="text-slate-400 truncate">Header: {s.roomHeader}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Match Test */}
            <div className="bg-purple-50 rounded-lg p-4">
              <h4 className="font-medium text-purple-800 mb-2">Match Test</h4>
              <p className="text-xs text-purple-600 mb-2">{diagnose.matchTest?.description}</p>
              {diagnose.matchTest?.dbSession && (
                <div className="text-sm">
                  <div className="mb-2">
                    <span className="font-medium">Looking for:</span> Room="{diagnose.matchTest.dbSession.room}" Time={diagnose.matchTest.dbSession.time} Date={diagnose.matchTest.dbSession.date}
                  </div>
                  <div className="font-medium">Potential matches by date+time:</div>
                  {diagnose.matchTest.potentialMatches?.length > 0 ? (
                    <div className="bg-white rounded p-2 mt-1 space-y-1">
                      {diagnose.matchTest.potentialMatches.map((m, i) => (
                        <div key={i} className="text-xs">
                          Room: <span className="bg-purple-100 px-1 rounded">{m.room || 'null'}</span> | {m.name}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-red-600 text-xs mt-1">No sessions found matching date+time!</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview Results */}
      {preview && (
        <div className="card mb-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Sync Preview</h3>
            <button
              className="text-slate-500 hover:text-slate-700"
              onClick={() => setPreview(null)}
            >
              ✕
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-slate-700">{preview.summary?.sheetSessions || 0}</div>
              <div className="text-sm text-slate-500">Sheet Sessions</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-700">{preview.summary?.matched || 0}</div>
              <div className="text-sm text-green-600">Matched</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">{preview.summary?.changesFound || 0}</div>
              <div className="text-sm text-blue-600">Changes Found</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-amber-700">{preview.summary?.unmatched || 0}</div>
              <div className="text-sm text-amber-600">Unmatched</div>
            </div>
          </div>

          {/* Changes List - Side by Side */}
          {preview.changes?.length > 0 ? (
            <div className="space-y-4">
              <h4 className="font-medium text-slate-700">
                Review Changes ({preview.changes.length} sessions with differences):
              </h4>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {preview.changes.map((change, idx) => (
                  <div key={change.id || idx} className="border-2 border-slate-200 rounded-lg overflow-hidden">
                    {/* Session Header */}
                    <div className="bg-slate-100 px-4 py-3 flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-slate-800">{change.sessionName}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {change.dbSession?.room} • {change.dbSession?.date}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded font-medium ${
                        change.matchType === 'exact_name'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {change.matchType} {change.matchScore && `(${change.matchScore}%)`}
                      </span>
                    </div>

                    {/* Differences Table */}
                    <div className="divide-y divide-slate-100">
                      {change.diffs?.map((diff, i) => {
                        const key = `${change.dbSession?.id}-${diff.field}`
                        const isApplied = appliedFields[key]
                        const isApplying = applyingField === key
                        const canApply = diff.field !== 'moderator' && !isApplied

                        return (
                          <div key={i} className={`px-4 py-3 ${isApplied ? 'bg-green-50' : ''}`}>
                            <div className="grid grid-cols-12 gap-4 items-center">
                              {/* Field Label */}
                              <div className="col-span-2">
                                <span className="text-sm font-medium text-slate-600">{diff.label}</span>
                              </div>

                              {/* DB Value (Current) */}
                              <div className="col-span-4">
                                <div className="text-xs text-slate-400 mb-1">Database</div>
                                <div className="text-sm bg-red-50 px-2 py-1 rounded text-red-700 font-mono">
                                  {diff.db || '(empty)'}
                                </div>
                              </div>

                              {/* Sheet Value (New) */}
                              <div className="col-span-4">
                                <div className="text-xs text-slate-400 mb-1">Sheet</div>
                                <div className="text-sm bg-green-50 px-2 py-1 rounded text-green-700 font-mono">
                                  {diff.sheet || '(empty)'}
                                </div>
                              </div>

                              {/* Apply Button */}
                              <div className="col-span-2 text-right">
                                {isApplied ? (
                                  <span className="text-xs text-green-600 font-medium">Applied</span>
                                ) : canApply ? (
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => applyOneChange(
                                      change.dbSession?.id,
                                      diff.field,
                                      diff.sheet,
                                      diff.newRoomId
                                    )}
                                    disabled={isApplying}
                                  >
                                    {isApplying ? '...' : 'Apply'}
                                  </button>
                                ) : diff.field === 'moderator' ? (
                                  <span className="text-xs text-slate-400">Review Only</span>
                                ) : null}
                              </div>
                            </div>
                            {diff.note && (
                              <div className="mt-1 text-xs text-slate-500 italic ml-[16.666%]">
                                {diff.note}
                              </div>
                            )}
                          </div>
                        )
                      })}
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

          {/* Unmatched Sessions */}
          {preview.unmatched?.length > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer font-medium text-amber-700 mb-2">
                Unmatched Sheet Sessions ({preview.unmatched.length})
              </summary>
              <div className="max-h-64 overflow-y-auto space-y-2 mt-2">
                {preview.unmatched.map((s, idx) => (
                  <div key={idx} className="border border-amber-200 rounded-lg p-3 bg-amber-50 text-sm">
                    <div className="font-medium text-slate-800">{s.name}</div>
                    <div className="text-xs text-slate-500">
                      {s.room} • {s.time} • {s.date}
                    </div>
                    <div className="text-xs text-amber-600 mt-1">Reason: {s.reason}</div>
                  </div>
                ))}
              </div>
            </details>
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
