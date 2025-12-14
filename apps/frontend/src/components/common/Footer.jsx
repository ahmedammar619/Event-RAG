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
        <div className="max-w-4xl mx-auto flex flex-col-reverse sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <p className="text-slate-400 m-0">
              &copy; {currentYear} Vewoz
            </p>
            <span className="text-slate-600">•</span>
            <a
              href="https://ahmedammar.dev?mascon"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 no-underline hover:text-white transition-colors px-3 py-1 rounded-full bg-slate-700 hover:bg-slate-600"
            >
              Developer
            </a>
          </div>
          <Link
            to={portalLink.to}
            className="text-slate-300 no-underline hover:text-white transition-colors px-4 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600"
          >
            {portalLink.label}
          </Link>
        </div>
      </footer>
    )
  }

  // Light/transparent variant for dark background pages (like landing)
  return (
    <footer className="w-full py-4 px-6 mt-auto">
      <div className="max-w-4xl mx-auto flex flex-col-reverse sm:flex-row items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <p className="text-white/60 m-0">
            &copy; {currentYear} Vewoz
          </p>
          <span className="text-white/30">•</span>
          <a
            href="https://ahmedammar.dev?mascon"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white no-underline hover:text-white transition-colors px-3 py-1 rounded-full bg-white/20 hover:bg-white/30"
          >
            Developer
          </a>
        </div>
        <Link
          to={portalLink.to}
          className="text-white no-underline hover:text-white transition-colors px-4 py-1.5 rounded-full bg-white/20 hover:bg-white/30"
        >
          {portalLink.label}
        </Link>
      </div>
    </footer>
  )
}
