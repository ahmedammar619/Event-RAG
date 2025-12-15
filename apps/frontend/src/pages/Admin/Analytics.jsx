import { useState, useEffect } from 'react'
import { analyticsService } from '../../services/api'
import { useToast } from '../../context/ToastContext'

export default function Analytics() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [days, setDays] = useState(30)

  useEffect(() => {
    fetchAnalytics()
  }, [days])

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const response = await analyticsService.getAnalytics({ days, limit: 100 })
      setData(response.data.data)
    } catch (err) {
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>
  }

  const stats = data?.stats || {}
  const topPages = data?.topPages || []
  const topReferrers = data?.topReferrers || []
  const browsers = data?.browsers || []
  const dailyVisits = data?.dailyVisits || []
  const analytics = data?.analytics || []

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1>Analytics</h1>
          <p>Track visitor activity and engagement</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="form-input w-auto"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-value">{stats.total_events || 0}</div>
          <div className="stat-label">Total Page Views</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.unique_sessions || 0}</div>
          <div className="stat-label">Unique Sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.unique_ips || 0}</div>
          <div className="stat-label">Unique IPs</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.logged_in_users || 0}</div>
          <div className="stat-label">Logged In Users</div>
        </div>
      </div>

      {/* Device Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Device Types</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Desktop</span>
              <span className="font-semibold">{stats.desktop_visits || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Mobile</span>
              <span className="font-semibold">{stats.mobile_visits || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Tablet</span>
              <span className="font-semibold">{stats.tablet_visits || 0}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Top Pages</h3>
          <div className="space-y-2">
            {topPages.length === 0 ? (
              <p className="text-slate-500 text-sm">No data yet</p>
            ) : (
              topPages.slice(0, 5).map((page, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 truncate mr-2">{page.current_page}</span>
                  <span className="font-semibold">{page.visits}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Browsers</h3>
          <div className="space-y-2">
            {browsers.length === 0 ? (
              <p className="text-slate-500 text-sm">No data yet</p>
            ) : (
              browsers.slice(0, 5).map((b, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">{b.browser || 'Unknown'}</span>
                  <span className="font-semibold">{b.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Referrers */}
      {topReferrers.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">Top Referrers</h3>
          <div className="space-y-2">
            {topReferrers.map((ref, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-slate-600 truncate mr-4">{ref.referrer}</span>
                <span className="font-semibold">{ref.visits}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Visits Chart */}
      {dailyVisits.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">Daily Visits</h3>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Page Views</th>
                  <th>Unique Visitors</th>
                </tr>
              </thead>
              <tbody>
                {dailyVisits.slice(0, 14).map((day, i) => (
                  <tr key={i}>
                    <td>{new Date(day.date).toLocaleDateString()}</td>
                    <td>{day.visits}</td>
                    <td>{day.unique_visitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="overflow-x-auto max-h-96">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Page</th>
                <th>User</th>
                <th>Device</th>
                <th>Browser</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {analytics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-slate-500">No activity yet</td>
                </tr>
              ) : (
                analytics.map((item, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap text-sm">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td className="text-sm max-w-[150px] truncate">{item.current_page}</td>
                    <td className="text-sm">
                      {item.user_name || <span className="text-slate-400">Guest</span>}
                    </td>
                    <td className="text-sm capitalize">{item.device_type}</td>
                    <td className="text-sm">{item.browser}</td>
                    <td className="text-sm font-mono text-xs">{item.ip_address}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
