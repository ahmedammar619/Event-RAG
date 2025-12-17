import { createContext, useContext, useState, useEffect } from 'react'
import { visitorsService } from '../services/api'
import api from '../services/api'

const VisitorContext = createContext(null)

export function VisitorProvider({ children }) {
  const [visitor, setVisitor] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('visitor_token')
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      fetchVisitor()
    } else {
      setLoading(false)
    }
  }, [])

  const fetchVisitor = async () => {
    try {
      const response = await visitorsService.getMe()
      setVisitor(response.data.data)
    } catch (err) {
      localStorage.removeItem('visitor_id')
      localStorage.removeItem('visitor_token')
      delete api.defaults.headers.common['Authorization']
    } finally {
      setLoading(false)
    }
  }

  const loginVisitor = async (email) => {
    const response = await visitorsService.login(email)
    const vis = response.data.data

    localStorage.setItem('visitor_id', vis.id)
    localStorage.setItem('visitor_token', vis.token)
    api.defaults.headers.common['Authorization'] = `Bearer ${vis.token}`
    setVisitor(vis)

    return vis
  }

  const registerVisitor = async (data) => {
    const response = await visitorsService.register(data)
    const vis = response.data.data

    localStorage.setItem('visitor_id', vis.id)
    localStorage.setItem('visitor_token', vis.token)
    api.defaults.headers.common['Authorization'] = `Bearer ${vis.token}`
    setVisitor(vis)

    return vis
  }

  const logoutVisitor = () => {
    localStorage.removeItem('visitor_id')
    localStorage.removeItem('visitor_token')
    delete api.defaults.headers.common['Authorization']
    setVisitor(null)
  }

  const refreshVisitor = async () => {
    const token = localStorage.getItem('visitor_token')
    if (token) {
      await fetchVisitor()
    }
  }

  const value = {
    visitor,
    loading,
    isAuthenticated: !!visitor,
    login: loginVisitor,
    register: registerVisitor,
    logout: logoutVisitor,
    refresh: refreshVisitor
  }

  return (
    <VisitorContext.Provider value={value}>
      {children}
    </VisitorContext.Provider>
  )
}

export function useVisitor() {
  const context = useContext(VisitorContext)
  if (!context) {
    throw new Error('useVisitor must be used within VisitorProvider')
  }
  return context
}
