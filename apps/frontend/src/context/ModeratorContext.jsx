import { createContext, useContext, useState, useEffect } from 'react'
import { moderatorsService } from '../services/api'

const ModeratorContext = createContext(null)

export function ModeratorProvider({ children }) {
  const [moderator, setModerator] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const moderatorId = localStorage.getItem('moderator_id')
    if (moderatorId) {
      fetchModerator(moderatorId)
    } else {
      setLoading(false)
    }
  }, [])

  const fetchModerator = async (id) => {
    try {
      const response = await moderatorsService.getById(id)
      setModerator(response.data.data)
    } catch (err) {
      localStorage.removeItem('moderator_id')
      localStorage.removeItem('moderator_token')
    } finally {
      setLoading(false)
    }
  }

  const loginModerator = async (email) => {
    const response = await moderatorsService.getByEmail(email)
    const mod = response.data.data

    localStorage.setItem('moderator_id', mod.id)
    localStorage.setItem('moderator_token', mod.token)
    setModerator(mod)

    return mod
  }

  const registerModerator = async (data) => {
    const response = await moderatorsService.register(data)
    const mod = response.data.data

    localStorage.setItem('moderator_id', mod.id)
    localStorage.setItem('moderator_token', mod.token)
    setModerator(mod)

    return mod
  }

  const logoutModerator = () => {
    localStorage.removeItem('moderator_id')
    localStorage.removeItem('moderator_token')
    setModerator(null)
  }

  const refreshModerator = async () => {
    const moderatorId = localStorage.getItem('moderator_id')
    if (moderatorId) {
      await fetchModerator(moderatorId)
    }
  }

  const value = {
    moderator,
    loading,
    isAuthenticated: !!moderator,
    login: loginModerator,
    register: registerModerator,
    logout: logoutModerator,
    refresh: refreshModerator
  }

  return (
    <ModeratorContext.Provider value={value}>
      {children}
    </ModeratorContext.Provider>
  )
}

export function useModerator() {
  const context = useContext(ModeratorContext)
  if (!context) {
    throw new Error('useModerator must be used within ModeratorProvider')
  }
  return context
}
