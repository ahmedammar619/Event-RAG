import { useState } from 'react'
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import { useModerator } from '../../context/ModeratorContext'

export default function ModeratorLayout() {
  const { moderator, logout } = useModerator()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const navItems = [
    { to: '/portal', label: 'My Schedule', icon: '📅', end: true },
    { to: '/portal/availability', label: 'Availability', icon: '⏰' }
  ]

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-white border-b border-slate-200">
        <button
          className="p-2 text-2xl bg-transparent border-none"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          ☰
        </button>
        <span className="font-semibold text-lg">MASCON</span>
        <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
          {moderator?.name?.charAt(0) || 'M'}
        </div>
      </header>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 bottom-0 z-50 w-64
        bg-gradient-to-b from-emerald-700 to-emerald-900 text-white
        flex flex-col transition-transform duration-300
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-bold text-white m-0">MASCON</h1>
          <span className="text-xs text-white/50 uppercase tracking-widest">Moderator Portal</span>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `
                flex items-center gap-3 px-6 py-3 text-white/70 no-underline
                transition-all duration-200 border-l-4 border-transparent
                hover:bg-white/10 hover:text-white hover:no-underline
                ${isActive ? 'bg-emerald-600/30 text-white border-l-white' : ''}
              `}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="text-lg w-6 text-center">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center font-semibold">
              {moderator?.name?.charAt(0) || 'M'}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium truncate">{moderator?.name}</span>
              <span className="text-xs text-white/50 truncate">{moderator?.email}</span>
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

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <div className="flex-1 p-4 lg:p-8 mt-16 lg:mt-0">
          <Outlet />
        </div>

        <footer className="p-4 lg:px-8 text-center text-sm text-slate-500 border-t border-slate-200 bg-white">
          <p className="m-0">
            &copy; {new Date().getFullYear()} MASCON.{' '}
            <a href="https://ahmedammar.dev?mascon" target="_blank" rel="noopener noreferrer" className="text-emerald-600">
              Developer
            </a>
            {' | '}
            <Link to="/admin/login" className="text-emerald-600">
              Admin
            </Link>
          </p>
        </footer>
      </main>
    </div>
  )
}
