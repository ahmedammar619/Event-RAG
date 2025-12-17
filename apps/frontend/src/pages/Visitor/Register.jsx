import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useVisitor } from '../../context/VisitorContext'
import { useToast } from '../../context/ToastContext'
import Header from '../../components/common/Header'
import Footer from '../../components/common/Footer'

export default function VisitorRegister() {
  const navigate = useNavigate()
  const toast = useToast()
  const { register, isAuthenticated, loading: authLoading } = useVisitor()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: ''
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/explore')
    }
  }, [authLoading, isAuthenticated, navigate])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setErrors({ ...errors, [e.target.name]: '' })
  }

  const validate = () => {
    const newErrors = {}

    if (!form.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!form.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email format'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validate()) return

    setLoading(true)
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase()
      })
      toast.success('Account created! Welcome to the session explorer.')
      navigate('/explore')
    } catch (err) {
      if (err.response?.status === 409) {
        setErrors({ email: 'An account with this email already exists. Please sign in.' })
      } else {
        toast.error('Something went wrong. Please try again.')
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold mb-2">Discover Sessions with AI</h1>
              <p className="text-slate-500">Create an account to get personalized session recommendations</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Your Name</label>
                <input
                  type="text"
                  name="name"
                  className="form-input"
                  placeholder="Enter your name"
                  value={form.name}
                  onChange={handleChange}
                />
                {errors.name && <p className="form-error">{errors.name}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  name="email"
                  className="form-input"
                  placeholder="Enter your email"
                  value={form.email}
                  onChange={handleChange}
                />
                {errors.email && <p className="form-error">{errors.email}</p>}
              </div>

              <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                {loading ? 'Creating account...' : 'Get Started'}
              </button>
            </form>

            <p className="text-center mt-6 text-sm text-slate-500">
              Already have an account? <Link to="/visitor/login" className="text-purple-600 hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
