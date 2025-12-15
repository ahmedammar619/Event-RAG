import { Link, useLocation } from 'react-router-dom'

export default function Footer({ variant = 'default' }) {
  const currentYear = new Date().getFullYear()
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')
  const isPortalRoute = location.pathname.startsWith('/portal')

  const getPortalLink = () => {
    if (isAdminRoute || isPortalRoute) {
      return { to: '/', label: 'Home' }
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
              className="text-white no-underline hover:text-white transition-colors px-3 py-1 rounded-full bg-white/20 hover:bg-white/30"
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

  // Default: light background footer
  return (
    <footer className="w-full py-4 px-6 mt-auto bg-white border-t border-slate-200">
      <div className="max-w-4xl mx-auto flex flex-col-reverse sm:flex-row items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <p className="text-slate-500 m-0">
            &copy; {currentYear} Vewoz
          </p>
          <span className="text-slate-300">•</span>
          <a
            href="https://ahmedammar.dev?mascon"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 no-underline"
          >
            Developer
          </a>
        </div>
        <Link
          to={portalLink.to}
          className="text-slate-600 no-underline hover:text-slate-800 transition-colors px-4 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200"
        >
          {portalLink.label}
        </Link>
      </div>
    </footer>
  )
}
