import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useVisitor } from '../../context/VisitorContext'
import { useToast } from '../../context/ToastContext'
import Header from '../../components/common/Header'
import Footer from '../../components/common/Footer'

export default function VisitorLogin() {
  const navigate = useNavigate()
  const toast = useToast()
  const { login, isAuthenticated, loading: authLoading } = useVisitor()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/explore')
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
      navigate('/explore')
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
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold mb-2">Welcome Back</h1>
              <p className="text-slate-500">Sign in to explore sessions with AI assistance</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
                {error && <p className="form-error">{error}</p>}
              </div>

              <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Continue to Explore'}
              </button>
            </form>

            <p className="text-center mt-6 text-sm text-slate-500">
              New here? <Link to="/visitor/register" className="text-purple-600 hover:underline">Create an account</Link>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
