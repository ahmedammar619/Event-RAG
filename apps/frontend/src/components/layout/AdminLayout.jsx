import { useState } from 'react'
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Footer from '../common/Footer'

export default function AdminLayout() {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  const navItems = [
    { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
    { to: '/admin/days', label: 'Event Days', icon: '📅' },
    { to: '/admin/rooms', label: 'Rooms', icon: '🚪' },
    { to: '/admin/sessions', label: 'Sessions', icon: '📋' },
    { to: '/admin/moderators', label: 'Moderators', icon: '👥' },
    { to: '/admin/assignments', label: 'Assignments', icon: '✅' },
    { to: '/admin/export', label: 'Export Data', icon: '📥' }
    // { to: '/admin/analytics', label: 'Analytics', icon: '📈' }
  ]

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-blue-700 text-white">
        <button
          className="p-2 text-2xl bg-transparent border-none text-white"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          ☰
        </button>
        <div className="flex items-center gap-2">
          <img src="/logo.png?3" alt="Vewoz" className="w-12 h-12 object-contain" />
          <span className="vewoz-logo text-2xl">Vewoz</span>
        </div>
        <div className="w-8 h-8 bg-white/20 text-white rounded-full flex items-center justify-center text-sm font-semibold">
          {admin?.name?.charAt(0) || 'A'}
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
        bg-gradient-to-b from-blue-800 to-blue-950 text-white
        flex flex-col transition-transform duration-300
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-white/10">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <img src="/logo.png?3" alt="Vewoz" className="w-16 h-16 object-contain" />
            <div>
              <h1 className="vewoz-logo text-3xl m-0">Vewoz</h1>
              <span className="text-xs text-white/50 uppercase tracking-widest">MASCON Admin</span>
            </div>
          </Link>
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
                ${isActive ? 'bg-blue-600/30 text-white border-l-white' : ''}
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
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center font-semibold">
              {admin?.name?.charAt(0) || 'A'}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium truncate">{admin?.name}</span>
              <span className="text-xs text-white/50 truncate">@{admin?.username}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-2 bg-white/10 border-none rounded-lg text-white text-sm cursor-pointer hover:bg-white/20 transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <div className="flex-1 p-4 lg:p-8 mt-28 lg:mt-0">
          <Outlet />
        </div>

        <Footer />
      </main>
    </div>
  )
}
