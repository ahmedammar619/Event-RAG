import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const success = useCallback((message) => addToast(message, 'success'), [addToast])
  const error = useCallback((message) => addToast(message, 'error'), [addToast])
  const warning = useCallback((message) => addToast(message, 'warning'), [addToast])

  const getToastStyle = (type) => {
    const baseStyle = {
      padding: '16px 24px',
      borderRadius: '8px',
      fontWeight: '500',
      minWidth: '250px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
      color: 'white',
    }

    if (type === 'success') {
      return { ...baseStyle, backgroundColor: '#22c55e' }
    } else if (type === 'error') {
      return { ...baseStyle, backgroundColor: '#ef4444' }
    } else if (type === 'warning') {
      return { ...baseStyle, backgroundColor: '#f59e0b' }
    }
    return baseStyle
  }

  return (
    <ToastContext.Provider value={{ success, error, warning }}>
      {children}
      <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {toasts.map(toast => (
          <div key={toast.id} style={getToastStyle(toast.type)}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
