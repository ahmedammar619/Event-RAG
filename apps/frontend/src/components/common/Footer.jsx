import { Link, useLocation } from 'react-router-dom'

export default function Footer() {
  const currentYear = new Date().getFullYear()
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')

  return (
    <footer className="bg-slate-800 text-slate-400 py-6 px-4 text-center mt-auto">
      <div className="flex flex-col gap-3 items-center">
        <div className="flex gap-6 flex-wrap justify-center">
          {!isAdminRoute && (
            <Link
              to="/admin/login"
              className="text-blue-400 no-underline text-sm font-medium px-2 py-1 rounded transition-colors hover:bg-blue-400/10 hover:no-underline"
            >
              Admin Login
            </Link>
          )}
          {isAdminRoute && (
            <Link
              to="/"
              className="text-blue-400 no-underline text-sm font-medium px-2 py-1 rounded transition-colors hover:bg-blue-400/10 hover:no-underline"
            >
              Moderator Portal
            </Link>
          )}
        </div>
        <p className="m-0 text-sm">
          &copy; {currentYear} MASCOM.{' '}
          <a
            href="https://ahmedammar.dev?mascom"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 font-medium no-underline hover:underline"
          >
            Developer
          </a>
        </p>
      </div>
    </footer>
  )
}
