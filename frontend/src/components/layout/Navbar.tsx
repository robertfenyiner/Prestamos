import { Menu, Moon, Sun, Bell } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useNavigate } from 'react-router-dom'

interface NavbarProps {
  onMenuToggle: () => void
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  return (
    <div className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onMenuToggle}
          className="btn-ghost"
          style={{
            padding: 8,
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Notifications */}
        <button
          onClick={() => navigate('/notificaciones')}
          className="btn-ghost"
          style={{
            padding: 8,
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
          }}
          aria-label="Notificaciones"
        >
          <Bell size={20} />
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="btn-ghost"
          style={{
            padding: 8,
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </div>
  )
}
