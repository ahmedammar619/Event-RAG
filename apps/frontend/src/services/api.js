import axios from 'axios'

// Remove trailing slash from API URL if present
const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '')

const api = axios.create({
  baseURL: `${apiUrl}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add token from localStorage if exists
const token = localStorage.getItem('admin_token')
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

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
  getMe: () => api.get('/admin/me')
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
  register: (data) => api.post('/moderators/register', data),
  update: (id, data) => api.put(`/moderators/${id}`, data),
  delete: (id) => api.delete(`/moderators/${id}`)
}

export const availabilityService = {
  getByModerator: (id) => api.get(`/availability/moderator/${id}`),
  create: (data) => api.post('/availability', data),
  bulkCreate: (moderatorId, slots) => api.post('/availability/bulk', { moderator_id: moderatorId, slots }),
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
