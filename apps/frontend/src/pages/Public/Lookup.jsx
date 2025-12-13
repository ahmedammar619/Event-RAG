import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { moderatorsService } from '../../services/api'
import { useToast } from '../../context/ToastContext'

export default function Lookup() {
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

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
      const response = await moderatorsService.getByEmail(email)
      const moderator = response.data.data

      localStorage.setItem('moderator_token', moderator.token)
      localStorage.setItem('moderator_id', moderator.id)

      toast.success('Welcome back!')
      navigate(`/availability/${moderator.id}`)
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
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4 text-slate-500 text-sm hover:text-slate-700">
            &larr; Back
          </Link>
          <h1 className="text-2xl font-semibold mb-2">Update Your Availability</h1>
          <p className="text-slate-500">Enter your email to access your account</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-8">
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
  )
}
