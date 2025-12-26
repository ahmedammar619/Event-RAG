import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useModerator } from '../../context/ModeratorContext'
import { useToast } from '../../context/ToastContext'
import Header from '../../components/common/Header'
import Footer from '../../components/common/Footer'

export default function Lookup() {
  const navigate = useNavigate()
  const toast = useToast()
  const { login, isAuthenticated, loading: authLoading } = useModerator()
  const [loading, setLoading] = useState(false)
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  // Format phone number as user types: (XXX) XXX-XXXX
  const formatPhoneNumber = (value) => {
    const digits = value.replace(/\D/g, '')
    const limited = digits.slice(0, 10)
    if (limited.length === 0) return ''
    if (limited.length <= 3) return `(${limited}`
    if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`
    return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`
  }

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value)
    setPhone(formatted)
  }

  // If already logged in, redirect to portal
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/portal')
    }
  }, [authLoading, isAuthenticated, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!phone.trim()) {
      setError('Phone number is required')
      return
    }

    const digits = phone.replace(/\D/g, '')
    if (digits.length !== 10) {
      setError('Please enter a valid 10-digit phone number')
      return
    }

    setLoading(true)
    try {
      await login(phone)
      toast.success('Welcome back!')
      navigate('/portal')
    } catch (err) {
      if (err.response?.status === 404) {
        setError('No account found with this phone number. Please register first.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-semibold mb-2"> Moderator Session Access</h1>
              <p className="text-slate-500">Enter your phone number to access your account</p>
            </div>

            <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                className="form-input"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={handlePhoneChange}
              />
              {error && <p className="form-error">{error}</p>}
            </div>

              <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                {loading ? 'Looking up...' : 'Continue'}
              </button>
            </form>

            <p className="text-center mt-6 text-sm text-slate-500">
              Don't have an account? <Link to="/register">Register here</Link>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
