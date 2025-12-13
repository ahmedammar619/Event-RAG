import { Link } from 'react-router-dom'
import { useModerator } from '../../context/ModeratorContext'
import { useAuth } from '../../context/AuthContext'
import Footer from '../../components/common/Footer'

export default function Landing() {
  const { isAuthenticated: isModeratorLoggedIn, moderator } = useModerator()
  const { isAuthenticated: isAdminLoggedIn } = useAuth()

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-800 to-emerald-600">
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">MASCON 2025</h1>
          <h2 className="text-xl md:text-2xl font-normal text-white/90 mb-6">Moderation System</h2>
          <p className="text-lg text-white/80 mb-8 leading-relaxed">
            Help us coordinate volunteer moderators for the annual MASCON event in Chicago.
            Register as a volunteer and input your availability.
          </p>

          {isModeratorLoggedIn ? (
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link
                to="/portal"
                className="btn btn-lg bg-white text-emerald-600 hover:bg-emerald-50 no-underline"
              >
                Go to My Portal
              </Link>
              <p className="text-white/70 self-center">
                Welcome back, {moderator?.name}!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 justify-center mb-12">
              {isAdminLoggedIn && (
                <div className="flex justify-center mb-2">
                  <Link
                    to="/admin"
                    className="btn btn-lg bg-white text-blue-600 hover:bg-blue-50 no-underline"
                  >
                    Go to Admin Dashboard
                  </Link>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/register"
                  className="btn btn-lg bg-white text-emerald-600 hover:bg-emerald-50 no-underline"
                >
                  Register as Volunteer
                </Link>
                <Link
                  to="/lookup"
                  className="btn btn-lg border border-white/30 text-white hover:bg-white/10 no-underline"
                >
                  Already Registered?
                </Link>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-white text-lg font-semibold mb-2">1. Register</h3>
              <p className="text-white/70 text-sm">Enter your name, email, and phone number</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-white text-lg font-semibold mb-2">2. Set Availability</h3>
              <p className="text-white/70 text-sm">Select when you can volunteer each day</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-white text-lg font-semibold mb-2">3. Get Assigned</h3>
              <p className="text-white/70 text-sm">We'll assign you to sessions automatically</p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
