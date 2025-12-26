import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useModerator } from '../../context/ModeratorContext'
import { useToast } from '../../context/ToastContext'
import Header from '../../components/common/Header'
import Footer from '../../components/common/Footer'

export default function Register() {
  const navigate = useNavigate()
  const toast = useToast()
  const { register, login, isAuthenticated, loading: authLoading } = useModerator()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: ''
  })
  const [errors, setErrors] = useState({})

  // Format phone number as user types: (XXX) XXX-XXXX
  const formatPhoneNumber = (value) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')

    // Limit to 10 digits
    const limited = digits.slice(0, 10)

    // Format based on length
    if (limited.length === 0) return ''
    if (limited.length <= 3) return `(${limited}`
    if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`
    return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`
  }

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value)
    setForm({ ...form, phone: formatted })
  }

  // If already logged in, redirect to portal
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/portal')
    }
  }, [authLoading, isAuthenticated, navigate])

  const validate = () => {
    const newErrors = {}
    if (!form.name.trim()) newErrors.name = 'Name is required'
    if (!form.email.trim()) newErrors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email format'
    }
    if (!form.phone.trim()) {
      newErrors.phone = 'Phone number is required'
    } else {
      const digits = form.phone.replace(/\D/g, '')
      if (digits.length !== 10) {
        newErrors.phone = 'Please enter a valid 10-digit US phone number'
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      await register(form)
      toast.success('Registration successful!')
      navigate('/portal/availability')
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Registration failed'
      toast.error(message)

      if (err.response?.data?.error?.code === 'CONFLICT') {
        try {
          await login(form.phone)
          toast.info('You were already registered. Welcome back!')
          navigate('/portal/availability')
        } catch (e) {
          // Ignore
        }
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
              <h1 className="text-2xl font-semibold mb-2">Moderator Registration</h1>
              <p className="text-slate-500">Register as a moderator for MASCON 2025</p>
            </div>

            <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter your full name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
              {errors.name && <p className="form-error">{errors.name}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                className="form-input"
                placeholder="Enter your email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input
                type="tel"
                className="form-input"
                placeholder="(555) 123-4567"
                value={form.phone}
                onChange={handlePhoneChange}
              />
              {errors.phone && <p className="form-error">{errors.phone}</p>}
            </div>

              <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                {loading ? 'Registering...' : 'Continue to Availability'}
              </button>
            </form>

            <p className="text-center mt-6 text-sm text-slate-500">
              Already registered? <Link to="/lookup">Enter your phone number</Link> to access your assigned sessions or update your availability.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
