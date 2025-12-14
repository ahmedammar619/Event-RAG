import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import { useModerator } from '../../context/ModeratorContext'

export default function ModeratorLayout() {
  const { moderator, logout } = useModerator()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const navItems = [
    {
      to: '/portal',
      label: 'Schedule',
      end: true,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      to: '/portal/availability',
      label: 'Availability',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ]

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed top-0 left-0 bottom-0 w-64 bg-gradient-to-b from-emerald-700 to-emerald-900 text-white flex-col z-50">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-bold text-white m-0">MASCON</h1>
          <span className="text-xs text-white/50 uppercase tracking-widest">Moderator Portal</span>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `
                flex items-center gap-3 px-6 py-3 text-white/70 no-underline
                transition-all border-l-4 border-transparent
                hover:bg-white/10 hover:text-white
                ${isActive ? 'bg-emerald-600/30 text-white border-l-white' : ''}
              `}
            >
              {item.icon}
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center font-semibold text-lg">
              {moderator?.name?.charAt(0) || 'M'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{moderator?.name}</div>
              <div className="text-xs text-white/50 truncate">{moderator?.email}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-2 bg-white/10 border-none rounded-lg text-white text-sm cursor-pointer hover:bg-white/20 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-emerald-700 text-white px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg m-0">MASCON</h1>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs bg-white/20 px-3 py-1.5 rounded-lg border-none text-white cursor-pointer hover:bg-white/30"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pb-24 lg:pb-0">
        <div className="pt-20 lg:pt-8 px-4 pb-6 lg:px-8 max-w-4xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `
                flex-1 flex flex-col items-center gap-1 py-3 no-underline transition-colors
                ${isActive ? 'text-emerald-600' : 'text-slate-400'}
              `}
            >
              {item.icon}
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
        {/* Safe area for phones with home indicators */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

      {/* Desktop Footer */}
      <footer className="hidden lg:block fixed bottom-0 left-64 right-0 p-4 text-center text-sm text-slate-500 bg-white border-t border-slate-200">
        &copy; {new Date().getFullYear()} MASCON.{' '}
        <a href="https://ahmedammar.dev?mascon" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
          Developer
        </a>
        {' | '}
        <Link to="/admin/login" className="text-emerald-600 hover:underline">
          Admin
        </Link>
      </footer>
    </div>
  )
}
