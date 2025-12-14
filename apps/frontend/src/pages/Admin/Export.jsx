import { useState } from 'react'
import { moderatorsService, sessionsService, assignmentsService, daysService, roomsService, adminService } from '../../services/api'
import { useToast } from '../../context/ToastContext'

export default function Export() {
  const toast = useToast()
  const [loading, setLoading] = useState({})
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetStep, setResetStep] = useState(1)
  const [confirmText, setConfirmText] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const downloadCSV = (data, filename) => {
    if (!data || data.length === 0) {
      toast.error('No data to export')
      return
    }

    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          let cell = row[header]
          if (cell === null || cell === undefined) cell = ''
          if (typeof cell === 'object') cell = JSON.stringify(cell)
          // Escape quotes and wrap in quotes if contains comma
          cell = String(cell).replace(/"/g, '""')
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            cell = `"${cell}"`
          }
          return cell
        }).join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    toast.success(`${filename} downloaded!`)
  }

  const exportModerators = async () => {
    setLoading(prev => ({ ...prev, moderators: true }))
    try {
      const response = await moderatorsService.getAll()
      const data = response.data.data.map(m => ({
        ID: m.id,
        Name: m.name,
        Email: m.email,
        Phone: m.phone || '',
        'Schedule Preference': m.schedule_preference || 'no_preference',
        'Total Availability Hours': m.total_availability_hours || 0,
        'Assignment Count': m.assignment_count || 0,
        'Registered At': m.created_at
      }))
      downloadCSV(data, 'moderators')
    } catch (err) {
      toast.error('Failed to export moderators')
    } finally {
      setLoading(prev => ({ ...prev, moderators: false }))
    }
  }

  const exportSessions = async () => {
    setLoading(prev => ({ ...prev, sessions: true }))
    try {
      const response = await sessionsService.getAll()
      const data = response.data.data.map(s => ({
        ID: s.id,
        Name: s.name,
        Date: s.date?.split('T')[0] || '',
        'Start Time': s.start_time,
        'End Time': s.end_time,
        Room: s.room_name || '',
        'Room Capacity': s.room_capacity || '',
        Headcount: s.headcount || '',
        'Headcount %': s.headcount_percentage || '',
        'Moderators Needed': s.moderators_needed,
        'Moderators Assigned': s.assigned_moderators?.length || 0,
        'Assigned Moderators': s.assigned_moderators?.map(m => m.name).join('; ') || ''
      }))
      downloadCSV(data, 'sessions')
    } catch (err) {
      toast.error('Failed to export sessions')
    } finally {
      setLoading(prev => ({ ...prev, sessions: false }))
    }
  }

  const exportAssignments = async () => {
    setLoading(prev => ({ ...prev, assignments: true }))
    try {
      const response = await assignmentsService.getAll()
      const data = response.data.data.map(a => ({
        'Assignment ID': a.id,
        'Session Name': a.session_name,
        Date: a.date?.split('T')[0] || '',
        'Start Time': a.session_start,
        'End Time': a.session_end,
        Room: a.room_name || '',
        'Moderator Name': a.moderator_name,
        'Moderator Email': a.moderator_email,
        'Assigned By': a.assigned_by,
        'Assigned At': a.assigned_at
      }))
      downloadCSV(data, 'assignments')
    } catch (err) {
      toast.error('Failed to export assignments')
    } finally {
      setLoading(prev => ({ ...prev, assignments: false }))
    }
  }

  const exportEventDays = async () => {
    setLoading(prev => ({ ...prev, days: true }))
    try {
      const response = await daysService.getAll()
      const data = response.data.data.map(d => ({
        ID: d.id,
        Date: d.date?.split('T')[0] || '',
        'Start Time': d.start_time,
        'End Time': d.end_time,
        'Created At': d.created_at
      }))
      downloadCSV(data, 'event_days')
    } catch (err) {
      toast.error('Failed to export event days')
    } finally {
      setLoading(prev => ({ ...prev, days: false }))
    }
  }

  const exportRooms = async () => {
    setLoading(prev => ({ ...prev, rooms: true }))
    try {
      const response = await roomsService.getAll()
      const data = response.data.data.map(r => ({
        ID: r.id,
        Name: r.name,
        Capacity: r.capacity || '',
        'Created At': r.created_at
      }))
      downloadCSV(data, 'rooms')
    } catch (err) {
      toast.error('Failed to export rooms')
    } finally {
      setLoading(prev => ({ ...prev, rooms: false }))
    }
  }

  const exportAll = async () => {
    setLoading(prev => ({ ...prev, all: true }))
    try {
      await exportModerators()
      await exportSessions()
      await exportAssignments()
      await exportEventDays()
      await exportRooms()
    } finally {
      setLoading(prev => ({ ...prev, all: false }))
    }
  }

  const exports = [
    {
      key: 'moderators',
      title: 'Moderators',
      description: 'All registered volunteers with contact info and availability',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      action: exportModerators
    },
    {
      key: 'sessions',
      title: 'Sessions',
      description: 'All sessions with times, rooms, and assigned moderators',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      action: exportSessions
    },
    {
      key: 'assignments',
      title: 'Assignments',
      description: 'Complete assignment list with moderator-session pairs',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      action: exportAssignments
    },
    {
      key: 'days',
      title: 'Event Days',
      description: 'Event dates with operating hours',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      action: exportEventDays
    },
    {
      key: 'rooms',
      title: 'Rooms',
      description: 'Room locations and capacities',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      action: exportRooms
    }
  ]

  return (
    <div>
      <div className="page-header">
        <h1>Export Data</h1>
        <p>Download data as CSV files (opens in Excel)</p>
      </div>

      {/* Export All Button */}
      <div className="card mb-6 p-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-1">Export All Data</h2>
            <p className="text-blue-100 text-sm">Download all tables as separate CSV files</p>
          </div>
          <button
            onClick={exportAll}
            disabled={loading.all}
            className="px-6 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            {loading.all ? 'Exporting...' : 'Export All'}
          </button>
        </div>
      </div>

      {/* Individual Exports */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exports.map(exp => (
          <div key={exp.key} className="card p-5 flex flex-col">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                {exp.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">{exp.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{exp.description}</p>
              </div>
            </div>
            <button
              onClick={exp.action}
              disabled={loading[exp.key]}
              className="mt-auto w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading[exp.key] ? 'Downloading...' : 'Download CSV'}
            </button>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <h4 className="font-medium text-slate-700 mb-2">About CSV Files</h4>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>• CSV files can be opened directly in Microsoft Excel, Google Sheets, or Numbers</li>
          <li>• Files are named with the current date for easy organization</li>
          <li>• Data is exported exactly as stored in the database</li>
        </ul>
      </div>

      {/* Danger Zone */}
      <div className="mt-10 p-6 bg-red-50 rounded-xl border-2 border-red-200">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-100 text-red-600 rounded-xl">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-red-800 mb-1">Danger Zone</h3>
            <p className="text-red-700 text-sm mb-4">
              Reset all event data to start fresh. This will permanently delete all moderators,
              their availability, all sessions, rooms, and assignments. Admin accounts and event days
              configuration will be preserved.
            </p>
            <button
              onClick={() => {
                setShowResetModal(true)
                setResetStep(1)
                setConfirmText('')
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              Reset All Event Data
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            {resetStep === 1 && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-full">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Backup Your Data First</h3>
                </div>
                <div className="mb-6">
                  <p className="text-slate-600 mb-4">
                    Before deleting, we recommend downloading a backup of all your data. This action <strong className="text-red-600">cannot be undone</strong>.
                  </p>
                  <div className="bg-slate-50 p-4 rounded-lg mb-4">
                    <p className="text-sm text-slate-600 mb-3">Click below to download all data as CSV files:</p>
                    <button
                      onClick={async () => {
                        setLoading(prev => ({ ...prev, backupAll: true }))
                        try {
                          await exportModerators()
                          await exportSessions()
                          await exportAssignments()
                          await exportEventDays()
                          await exportRooms()
                          toast.success('All data exported successfully!')
                        } finally {
                          setLoading(prev => ({ ...prev, backupAll: false }))
                        }
                      }}
                      disabled={loading.backupAll}
                      className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {loading.backupAll ? 'Downloading...' : 'Download All Data (5 CSV files)'}
                    </button>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">This will permanently delete:</p>
                  <ul className="text-sm text-slate-700 space-y-2 bg-red-50 p-4 rounded-lg mb-4">
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      All registered moderators
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      All moderator availability
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      All sessions
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      All rooms
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      All assignments
                    </li>
                  </ul>
                  <p className="text-sm text-slate-500">
                    <strong>Preserved:</strong> Admin accounts and event days configuration
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowResetModal(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setResetStep(2)}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                  >
                    Continue to Delete
                  </button>
                </div>
              </>
            )}

            {resetStep === 2 && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-100 text-red-600 rounded-full">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Final Confirmation</h3>
                </div>
                <div className="mb-6">
                  {/* Last chance backup button */}
                  <button
                    onClick={async () => {
                      setLoading(prev => ({ ...prev, backupAll: true }))
                      try {
                        await exportModerators()
                        await exportSessions()
                        await exportAssignments()
                        await exportEventDays()
                        await exportRooms()
                        toast.success('All data exported successfully!')
                      } finally {
                        setLoading(prev => ({ ...prev, backupAll: false }))
                      }
                    }}
                    disabled={loading.backupAll}
                    className="w-full mb-4 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 border border-slate-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {loading.backupAll ? 'Downloading...' : 'Download Backup First'}
                  </button>

                  <p className="text-slate-600 mb-4">
                    To confirm deletion, type <strong className="text-red-600 font-mono">DELETE ALL EVENT DATA</strong> below:
                  </p>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type here to confirm..."
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none font-mono text-center"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setResetStep(1)
                      setConfirmText('')
                    }}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={async () => {
                      if (confirmText !== 'DELETE ALL EVENT DATA') {
                        toast.error('Please type the confirmation text exactly')
                        return
                      }
                      setResetLoading(true)
                      try {
                        const response = await adminService.resetEventData(confirmText)
                        const deleted = response.data.data.deleted
                        toast.success(`Deleted: ${deleted.moderators} moderators, ${deleted.sessions} sessions, ${deleted.rooms} rooms, ${deleted.assignments} assignments`)
                        setShowResetModal(false)
                        setResetStep(1)
                        setConfirmText('')
                      } catch (err) {
                        toast.error(err.response?.data?.error?.message || 'Failed to reset data')
                      } finally {
                        setResetLoading(false)
                      }
                    }}
                    disabled={confirmText !== 'DELETE ALL EVENT DATA' || resetLoading}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetLoading ? 'Deleting...' : 'Delete Everything'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
