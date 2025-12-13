import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { moderatorsService } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import Footer from '../../components/common/Footer'

export default function Register() {
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: ''
  })
  const [errors, setErrors] = useState({})

  const validate = () => {
    const newErrors = {}
    if (!form.name.trim()) newErrors.name = 'Name is required'
    if (!form.email.trim()) newErrors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email format'
    }
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const response = await moderatorsService.register(form)
      const moderator = response.data.data

      // Store token for later use
      localStorage.setItem('moderator_token', moderator.token)
      localStorage.setItem('moderator_id', moderator.id)

      toast.success('Registration successful!')
      navigate(`/availability/${moderator.id}`)
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Registration failed'
      toast.error(message)

      // If already registered, offer to go to availability
      if (err.response?.data?.error?.code === 'CONFLICT') {
        try {
          const existing = await moderatorsService.getByEmail(form.email)
          const moderator = existing.data.data
          localStorage.setItem('moderator_token', moderator.token)
          localStorage.setItem('moderator_id', moderator.id)
          navigate(`/availability/${moderator.id}`)
        } catch (e) {
          // Ignore
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-page">
      <div className="register-container">
        <div className="register-header">
          <Link to="/" className="back-link">&larr; Back</Link>
          <h1>Volunteer Registration</h1>
          <p>Register as a moderator volunteer for MASCOM 2025</p>
        </div>

        <form onSubmit={handleSubmit} className="register-form card">
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
              placeholder="Enter your phone number"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
            />
            {errors.phone && <p className="form-error">{errors.phone}</p>}
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Registering...' : 'Continue to Availability'}
          </button>
        </form>

        <p className="register-note">
          Already registered? <Link to="/">Enter your email</Link> to update your availability.
        </p>
      </div>
      <Footer />

      <style>{`
        .register-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: var(--bg);
        }

        .register-container {
          width: 100%;
          max-width: 480px;
        }

        .register-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .back-link {
          display: inline-block;
          margin-bottom: 1rem;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .register-header h1 {
          font-size: 1.75rem;
          margin-bottom: 0.5rem;
        }

        .register-header p {
          color: var(--text-muted);
        }

        .register-form {
          padding: 2rem;
        }

        .register-note {
          text-align: center;
          margin-top: 1.5rem;
          font-size: 0.875rem;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  )
}
