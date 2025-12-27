import axios from 'axios'

// Remove trailing slash from API URL if present
const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '')

const api = axios.create({
  baseURL: `${apiUrl}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor - adds auth token dynamically on each request
api.interceptors.request.use((config) => {
  const adminToken = localStorage.getItem('admin_token')
  const visitorToken = localStorage.getItem('visitor_token')
  const moderatorToken = localStorage.getItem('moderator_token')

  // Check if this is a visitor-facing AI route (search/reasoning, not admin settings)
  const isVisitorAIRoute = config.url?.includes('/ai/search') ||
                           config.url?.includes('/ai/reasoning') ||
                           config.url?.includes('/ai/sessions')
  const isVisitorRoute = isVisitorAIRoute || config.url?.includes('/visitors/me')

  // Prioritize visitor token for visitor routes, admin token otherwise
  const token = isVisitorRoute
    ? (visitorToken || adminToken || moderatorToken)
    : (adminToken || visitorToken || moderatorToken)

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    const message = error.response?.data?.error?.message || 'An error occurred'
    console.error('API Error:', message)
    return Promise.reject(error)
  }
)

export default api

// Service functions
export const adminService = {
  login: (username, password) => api.post('/admin/login', { username, password }),
  getDashboard: () => api.get('/admin/dashboard'),
  getMe: () => api.get('/admin/me'),
  resetEventData: (confirmation) => api.delete('/admin/reset-event-data', { data: { confirmation } })
}

export const daysService = {
  getAll: () => api.get('/days'),
  getById: (id) => api.get(`/days/${id}`),
  create: (data) => api.post('/days', data),
  update: (id, data) => api.put(`/days/${id}`, data),
  delete: (id) => api.delete(`/days/${id}`)
}

export const roomsService = {
  getAll: () => api.get('/rooms'),
  getById: (id) => api.get(`/rooms/${id}`),
  create: (data) => api.post('/rooms', data),
  update: (id, data) => api.put(`/rooms/${id}`, data),
  delete: (id) => api.delete(`/rooms/${id}`)
}

export const sessionsService = {
  getAll: (params) => api.get('/sessions', { params }),
  getById: (id) => api.get(`/sessions/${id}`),
  create: (data) => api.post('/sessions', data),
  update: (id, data) => api.put(`/sessions/${id}`, data),
  updateHeadcount: (id, data) => api.patch(`/sessions/${id}/headcount`, data),
  delete: (id) => api.delete(`/sessions/${id}`),
  bulkCreate: (sessions) => api.post('/sessions/bulk', { sessions })
}

export const moderatorsService = {
  getAll: () => api.get('/moderators'),
  getById: (id) => api.get(`/moderators/${id}`),
  getByEmail: (email) => api.get(`/moderators/by-email/${encodeURIComponent(email)}`),
  getByPhone: (phone) => api.get(`/moderators/by-phone/${encodeURIComponent(phone)}`),
  register: (data) => api.post('/moderators/register', data),
  update: (id, data) => api.put(`/moderators/${id}`, data),
  delete: (id) => api.delete(`/moderators/${id}`)
}

export const availabilityService = {
  getByModerator: (id) => api.get(`/availability/moderator/${id}`),
  create: (data) => api.post('/availability', data),
  bulkCreate: (moderatorId, slots) => api.post('/availability/bulk', { moderator_id: moderatorId, slots }),
  bulkCreateForDay: (moderatorId, dayId, slots) => api.post('/availability/bulk', { moderator_id: moderatorId, day_id: dayId, slots }),
  update: (id, data) => api.put(`/availability/${id}`, data),
  delete: (id) => api.delete(`/availability/${id}`)
}

export const assignmentsService = {
  getAll: (params) => api.get('/assignments', { params }),
  getBySession: (id) => api.get(`/assignments/session/${id}`),
  getByModerator: (id) => api.get(`/assignments/moderator/${id}`),
  autoAssign: (options) => api.post('/assignments/auto', options),
  manualAssign: (sessionId, moderatorId) => api.post('/assignments/manual', { session_id: sessionId, moderator_id: moderatorId }),
  delete: (id) => api.delete(`/assignments/${id}`),
  reset: (dayId) => api.delete('/assignments/reset', { data: { day_id: dayId } })
}

export const analyticsService = {
  track: (data) => api.post('/analytics/track', data).catch(() => {}), // Silent fail
  getAnalytics: (params) => api.get('/analytics', { params })
}

export const visitorsService = {
  register: (data) => api.post('/visitors/register', data),
  login: (email) => api.post('/visitors/login', { email }),
  getMe: () => api.get('/visitors/me')
}

export const aiService = {
  search: (query, sessionId) => api.post('/ai/search', { query, session_id: sessionId }),
  getReasoning: (query, sessionIds) => api.post('/ai/reasoning', { query, session_ids: sessionIds }),
  getSessions: (params) => api.get('/ai/sessions', { params }),
  getSession: (id) => api.get(`/ai/sessions/${id}`),
  getSettings: () => api.get('/ai/settings'),
  setSearchMode: (mode) => api.put('/ai/settings/search-mode', { mode }),
  setResultCount: (count) => api.put('/ai/settings/result-count', { count }),
  setLlmModel: (model) => api.put('/ai/settings/llm-model', { model }),
  setReasoningMode: (mode) => api.put('/ai/settings/reasoning-mode', { mode }),
  getHealth: () => api.get('/ai/health'),
  getAnalytics: (days) => api.get('/ai/analytics', { params: { days } })
}

export const speakersService = {
  getAll: () => api.get('/speakers'),
  getById: (id) => api.get(`/speakers/${id}`),
  update: (id, data) => api.put(`/speakers/${id}`, data),
  uploadFile: (id, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/speakers/${id}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  removeFile: (id) => api.delete(`/speakers/${id}/file`)
}

export const headcountService = {
  getSessions: (params) => api.get('/headcount/sessions', { params }),
  getRooms: () => api.get('/headcount/rooms'),
  getDates: () => api.get('/headcount/dates'),
  updateHeadcount: (id, data) => api.patch(`/headcount/sessions/${id}`, data),
  updateCapacity: (id, data) => api.patch(`/headcount/sessions/${id}/capacity`, data)
}

export const exportService = {
  getHeadcountStats: () => api.get('/export/headcount-stats'),
  downloadHeadcountReport: () => api.get('/export/headcount-report', { responseType: 'blob' })
}

export const syncService = {
  preview: () => api.get('/sync/preview'),
  apply: (changes) => api.post('/sync/apply', { changes }),
  getLogs: () => api.get('/sync/logs'),
  debug: (date) => api.get('/sync/debug', { params: { date } }),
  matchCheck: () => api.get('/sync/match-check'),
  raw: (date) => api.get('/sync/raw', { params: { date } })
}
