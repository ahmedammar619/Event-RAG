import { Link } from 'react-router-dom'
import { useModerator } from '../../context/ModeratorContext'
import { useAuth } from '../../context/AuthContext'
import Footer from '../../components/common/Footer'

export default function Landing() {
  const { isAuthenticated: isModeratorLoggedIn, moderator } = useModerator()
  const { isAuthenticated: isAdminLoggedIn } = useAuth()

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-800 to-blue-600">
      {/* Platform Header */}
      <header className="w-full py-4 px-6 flex items-center justify-center gap-3 bg-slate-900/50 backdrop-blur-sm border-b border-white/10">
        <img src="/logo.png?2" alt="Vewoz" className="w-24 h-24 lg:w-32 lg:h-32 object-contain" />
        <span className="text-white font-bold text-4xl">Vewoz</span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 md:p-10 max-w-3xl w-full shadow-xl border border-white/20">
          {/* Event Header with MASCON logo */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <img src="/mascon-logo.png" alt="MASCON 2025" className="w-16 h-16 md:w-20 md:h-20 object-contain" />
            <div className="text-left">
              <h1 className="text-2xl md:text-3xl font-bold text-white m-0">MASCON 2025</h1>
              <h2 className="text-sm md:text-base font-normal text-white/90 m-0">Moderation System</h2>
            </div>
          </div>
          <p className="text-lg text-white/80 mb-8 leading-relaxed">
            Help us coordinate volunteer moderators for the annual MASCON event in Chicago.
            Register as a volunteer and input your availability.
          </p>

          {isModeratorLoggedIn ? (
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link
                to="/portal"
                className="btn btn-lg bg-white text-blue-600 hover:bg-blue-50 no-underline"
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
                  className="btn btn-lg bg-white text-blue-600 hover:bg-blue-50 no-underline"
                >
                  Register as Volunteer
                </Link>
                <Link
                  to="/lookup"
                  className="btn btn-lg bg-white/20 text-white hover:bg-white/30 no-underline"
                >
                  Already Registered?
                </Link>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-white/10 rounded-lg p-4">
              <h3 className="text-white text-lg font-semibold mb-2">1. Register</h3>
              <p className="text-white/70 text-sm">Enter your name, email, and phone number</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <h3 className="text-white text-lg font-semibold mb-2">2. Set Availability</h3>
              <p className="text-white/70 text-sm">Select when you can volunteer each day</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
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
