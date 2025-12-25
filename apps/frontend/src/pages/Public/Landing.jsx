import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useModerator } from '../../context/ModeratorContext'
import { useAuth } from '../../context/AuthContext'
import { useVisitor } from '../../context/VisitorContext'
import Header from '../../components/common/Header'
import Footer from '../../components/common/Footer'

export default function Landing() {
  const { isAuthenticated: isModeratorLoggedIn, moderator } = useModerator()
  const { isAuthenticated: isAdminLoggedIn } = useAuth()
  const { isAuthenticated: isVisitorLoggedIn, visitor } = useVisitor()

  // Check if we're on the AI subdomain (ai.domain.com)
  const isAISubdomain = useMemo(() => {
    const hostname = window.location.hostname
    return hostname.startsWith('ai.') || hostname.startsWith('ai-')
  }, [])

  // Update document title based on subdomain
  useEffect(() => {
    if (isAISubdomain) {
      document.title = 'MASCON 2025 - AI Session Finder'
    } else {
      document.title = 'MASCON 2025 - Moderation System'
    }
  }, [isAISubdomain])

  // AI Subdomain - Show only visitor section
  if (isAISubdomain) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-purple-50 via-white to-purple-50">
        <Header />

        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
          <div className="bg-white rounded-2xl p-6 md:p-10 max-w-3xl w-full shadow-lg border border-purple-100">
            {/* Event Header with MASCON logo */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <img src="/mascon-logo.png?3" alt="MASCON 2025" className="w-16 h-16 md:w-20 md:h-20 object-contain" />
              <div className="text-left">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 m-0">MASCON 2025</h1>
                <h2 className="text-sm md:text-base font-normal text-purple-600 m-0">AI Session Finder</h2>
              </div>
            </div>

            <div className="text-center mb-8">
              <span className="text-5xl mb-4 block">🤖</span>
              <p className="text-lg text-slate-600 leading-relaxed">
                Discover the perfect sessions for your interests using our smart search.
                <br />
                <span className="text-purple-600 font-medium">Ask questions, get personalized recommendations!</span>
              </p>
            </div>

            {isVisitorLoggedIn ? (
              <div className="flex flex-col items-center gap-4">
                <Link
                  to="/explore"
                  className="btn btn-lg bg-purple-600 text-white hover:bg-purple-700 no-underline px-8"
                >
                  Explore Sessions
                </Link>
                <p className="text-slate-500">
                  Welcome back, {visitor?.name}!
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 items-center">
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    to="/visitor/login"
                    className="btn btn-lg bg-purple-600 text-white hover:bg-purple-700 no-underline px-8"
                  >
                    Find Sessions
                  </Link>
                  <Link
                    to="/visitor/register"
                    className="btn btn-lg bg-slate-100 text-slate-700 hover:bg-slate-200 no-underline border border-slate-300"
                  >
                    Create Account
                  </Link>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mt-10">
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                <h3 className="text-slate-800 text-lg font-semibold mb-2">1. Search</h3>
                <p className="text-slate-500 text-sm">Describe what you're looking for</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                <h3 className="text-slate-800 text-lg font-semibold mb-2">2. Discover</h3>
                <p className="text-slate-500 text-sm">Get matched with relevant sessions</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                <h3 className="text-slate-800 text-lg font-semibold mb-2">3. Understand</h3>
                <p className="text-slate-500 text-sm">AI explains why each session fits you</p>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  // Normal domain - Show moderator section with visitor section below
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="bg-white rounded-2xl p-6 md:p-10 max-w-3xl w-full shadow-lg border border-slate-200">
          {/* Event Header with MASCON logo */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <img src="/mascon-logo.png?3" alt="MASCON 2025" className="w-16 h-16 md:w-20 md:h-20 object-contain" />
            <div className="text-left">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 m-0">MASCON 2025</h1>
              <h2 className="text-sm md:text-base font-normal text-slate-500 m-0">Moderation System</h2>
            </div>
          </div>
          <p className="text-lg text-slate-600 mb-8 leading-relaxed text-center">
            Help us coordinate moderators for the annual MASCON event in Chicago.
            Register as a moderator and input your availability.
          </p>

          {isModeratorLoggedIn ? (
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link
                to="/portal"
                className="btn btn-lg bg-blue-600 text-white hover:bg-blue-700 no-underline"
              >
                Go to My Portal
              </Link>
              <p className="text-slate-500 self-center">
                Welcome back, {moderator?.name}!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 justify-center mb-12">
              {isAdminLoggedIn && (
                <div className="flex justify-center mb-2">
                  <Link
                    to="/admin"
                    className="btn btn-lg bg-blue-600 text-white hover:bg-blue-700 no-underline"
                  >
                    Go to Admin Dashboard
                  </Link>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/register"
                  className="btn btn-lg bg-blue-600 text-white hover:bg-blue-700 no-underline"
                >
                  Register as Moderator
                </Link>
                <Link
                  to="/lookup"
                  className="btn btn-lg bg-slate-100 text-slate-700 hover:bg-slate-200 no-underline border border-slate-300"
                >
                  Already Registered?
                </Link>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <h3 className="text-slate-800 text-lg font-semibold mb-2">1. Register</h3>
              <p className="text-slate-500 text-sm">Enter your name, email, and phone number</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <h3 className="text-slate-800 text-lg font-semibold mb-2">2. Set Availability</h3>
              <p className="text-slate-500 text-sm">Select when you can moderate each day</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <h3 className="text-slate-800 text-lg font-semibold mb-2">3. Get Assigned</h3>
              <p className="text-slate-500 text-sm">We'll assign you to sessions automatically</p>
            </div>
          </div>
        </div>

      </div>
      <Footer />
    </div>
  )
}
