import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Footer from '../common/Footer'

export default function AdminLayout() {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  const navItems = [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/days', label: 'Event Days' },
    { to: '/admin/rooms', label: 'Rooms' },
    { to: '/admin/sessions', label: 'Sessions' },
    { to: '/admin/moderators', label: 'Moderators' },
    { to: '/admin/assignments', label: 'Assignments' }
  ]

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="container flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="logo">MASCOM Admin</h1>
            <nav className="admin-nav">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted">{admin?.name}</span>
            <button onClick={handleLogout} className="btn btn-outline btn-sm">
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="admin-main">
        <div className="container">
          <Outlet />
        </div>
      </main>
      <Footer />

      <style>{`
        .admin-layout {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .admin-main {
          flex: 1;
        }

        .admin-header {
          background: white;
          border-bottom: 1px solid var(--border);
          padding: 0.75rem 0;
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .logo {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--primary);
        }

        .admin-nav {
          display: flex;
          gap: 0.25rem;
        }

        .nav-link {
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-muted);
          border-radius: var(--radius);
          text-decoration: none;
          transition: all 0.15s ease;
        }

        .nav-link:hover {
          color: var(--text);
          background: var(--bg);
          text-decoration: none;
        }

        .nav-link.active {
          color: var(--primary);
          background: #eff6ff;
        }

        @media (max-width: 1024px) {
          .admin-nav {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
