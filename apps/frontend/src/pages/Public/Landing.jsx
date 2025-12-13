import { Link } from 'react-router-dom'

export default function Landing() {
  const currentYear = new Date().getFullYear()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-800 to-blue-600 relative">
      <div className="text-center max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">MASCOM 2025</h1>
        <h2 className="text-xl md:text-2xl font-normal text-white/90 mb-6">Moderation System</h2>
        <p className="text-lg text-white/80 mb-8 leading-relaxed">
          Help us coordinate volunteer moderators for the annual MASCOM event in Chicago.
          Register as a volunteer and input your availability.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link
            to="/register"
            className="btn btn-lg bg-white text-blue-600 hover:bg-blue-50 no-underline"
          >
            Register as Volunteer
          </Link>
          <Link
            to="/admin/login"
            className="btn btn-lg border border-white/30 text-white hover:bg-white/10 no-underline"
          >
            Admin Login
          </Link>
        </div>

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

      <footer className="absolute bottom-4 left-0 right-0 text-center text-white/60 text-sm">
        &copy; {currentYear} MASCOM.{' '}
        <a
          href="https://ahmedammar.dev?mascom"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/90 no-underline hover:underline"
        >
          Developer
        </a>
      </footer>
    </div>
  )
}
