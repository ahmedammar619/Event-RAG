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
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  // If already logged in, redirect to portal
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/portal')
    }
  }, [authLoading, isAuthenticated, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Email is required')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Invalid email format')
      return
    }

    setLoading(true)
    try {
      await login(email)
      toast.success('Welcome back!')
      navigate('/portal')
    } catch (err) {
      if (err.response?.status === 404) {
        setError('No account found with this email. Please register first.')
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
              <h1 className="text-2xl font-semibold mb-2">Update Your Availability</h1>
              <p className="text-slate-500">Enter your email to access your account</p>
            </div>

            <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="Enter your registered email"
                value={email}
                onChange={e => setEmail(e.target.value)}
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
