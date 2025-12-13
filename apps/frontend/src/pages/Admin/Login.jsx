import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import Footer from '../../components/common/Footer'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const toast = useToast()

  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    email: '',
    password: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await login(form.email, form.password)
      toast.success('Login successful!')
      navigate('/admin')
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Login failed'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4 text-slate-500 text-sm hover:text-slate-700">
            &larr; Back to Home
          </Link>
          <h1 className="text-2xl font-semibold mb-2">Admin Login</h1>
          <p className="text-slate-500">Sign in to access the admin dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-8">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="admin@mascom.org"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter your password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
      <Footer />
    </div>
  )
}
