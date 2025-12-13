import { Link, useLocation } from 'react-router-dom'

export default function Footer({ variant = 'default' }) {
  const currentYear = new Date().getFullYear()
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')
  const isPortalRoute = location.pathname.startsWith('/portal')

  const getPortalLink = () => {
    if (isAdminRoute) {
      return { to: '/portal', label: 'Moderator Portal' }
    }
    if (isPortalRoute) {
      return { to: '/admin/login', label: 'Admin' }
    }
    return { to: '/admin/login', label: 'Admin' }
  }

  const portalLink = getPortalLink()

  // Dark variant for pages with light backgrounds
  if (variant === 'dark') {
    return (
      <footer className="w-full bg-slate-800 py-4 px-6 mt-auto">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <p className="text-slate-400 m-0">
            &copy; {currentYear} MASCON
          </p>
          <div className="flex items-center gap-4">
            <Link
              to={portalLink.to}
              className="text-slate-400 no-underline hover:text-white transition-colors"
            >
              {portalLink.label}
            </Link>
            <span className="text-slate-600">|</span>
            <a
              href="https://ahmedammar.dev?mascon"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 no-underline hover:text-white transition-colors"
            >
              Developer
            </a>
          </div>
        </div>
      </footer>
    )
  }

  // Light/transparent variant for dark background pages (like landing)
  return (
    <footer className="w-full py-4 px-6 mt-auto">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <p className="text-white/60 m-0">
          &copy; {currentYear} MASCON
        </p>
        <div className="flex items-center gap-4">
          <Link
            to={portalLink.to}
            className="text-white/60 no-underline hover:text-white transition-colors"
          >
            {portalLink.label}
          </Link>
          <span className="text-white/30">|</span>
          <a
            href="https://ahmedammar.dev?mascon"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 no-underline hover:text-white transition-colors"
          >
            Developer
          </a>
        </div>
      </div>
    </footer>
  )
}
