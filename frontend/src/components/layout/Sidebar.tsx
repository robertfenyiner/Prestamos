import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Settings,
  ChevronLeft, ChevronRight, LogOut, Landmark, UserRound,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface SidebarProps {
  collapsed: boolean
  mobileOpen: boolean
  onToggle: () => void
  onMobileClose: () => void
}

const navItems = [
  { section: 'General', items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  { section: 'Operación', items: [
    { to: '/prestamos', label: 'Préstamos', icon: Landmark },
    { to: '/clientes', label: 'Clientes', icon: UserRound },
  ]},
  { section: 'Sistema', items: [
    { to: '/settings', label: 'Configuración', icon: Settings },
  ]},
]

export default function Sidebar({ collapsed, mobileOpen, onToggle, onMobileClose }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src="/logo-garcia.jpg?v=2" alt="Garcia" className="sidebar-logo-img" />
          {!collapsed && <span>GARCIA</span>}
        </div>
        <button className="sidebar-toggle" onClick={onToggle}
          aria-label={collapsed ? 'Expandir' : 'Colapsar'}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(section => (
          <div key={section.section}>
            {!collapsed && <div className="sidebar-section-title">{section.section}</div>}
            {section.items.map(item => {
              const Icon = item.icon
              const isActive = location.pathname === item.to || (item.to !== '/dashboard' && location.pathname.startsWith(item.to))
              return (
                <NavLink key={item.to} to={item.to}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={() => mobileOpen && onMobileClose()}
                  title={collapsed ? item.label : undefined}>
                  <Icon className="sidebar-link-icon" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="sidebar-user">
            <div className="sidebar-user-info">
              <div className="sidebar-avatar">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="sidebar-user-meta">
                <div className="sidebar-user-name">{user?.name || 'Usuario'}</div>
                <div className="sidebar-user-role">{user?.role === 'admin' ? 'Administrador' : 'Usuario'}</div>
              </div>
            </div>
            <button onClick={handleLogout} title="Cerrar sesión" className="sidebar-logout">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
