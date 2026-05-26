import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Receipt, PiggyBank, Settings,
  ChevronLeft, ChevronRight, LogOut, BarChart3, Bell, CreditCard,
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
  { section: 'Módulos', items: [
    { to: '/gastos', label: 'Gastos', icon: Receipt },
    { to: '/reportes', label: 'Reportes', icon: BarChart3 },
    { to: '/ahorros', label: 'Ahorros', icon: PiggyBank },
    { to: '/tarjetas', label: 'Tarjetas', icon: CreditCard },
  ]},
  { section: 'Sistema', items: [
    { to: '/notificaciones', label: 'Notificaciones', icon: Bell },
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
          <img src="/logo.jpg" alt="RobertApp" style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
          {!collapsed && <span>RobertApp</span>}
        </div>
        <button className="btn-ghost" onClick={onToggle}
          style={{ padding: 6, borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--color-accent), #a78bfa)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 600, color: 'white', flexShrink: 0,
              }}>
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
                  {user?.name || 'Usuario'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                  {user?.role === 'admin' ? 'Administrador' : 'Usuario'}
                </div>
              </div>
            </div>
            <button onClick={handleLogout} title="Cerrar sesión"
              style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-sm)', transition: 'color var(--transition-fast)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}>
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
