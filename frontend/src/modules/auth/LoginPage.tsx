import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg-primary)',
      padding: 20,
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'fixed', top: '-20%', right: '-10%',
        width: 600, height: 600,
        background: 'radial-gradient(circle, var(--color-accent-soft) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '-15%', left: '-8%',
        width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />

      <div className="card animate-fade-in" style={{
        width: '100%', maxWidth: 420, padding: '40px 36px',
        position: 'relative', zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: 100, height: 100,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-accent), #a78bfa, #818cf8)',
            padding: 3,
            marginBottom: 16,
            boxShadow: '0 0 30px rgba(99, 102, 241, 0.4), 0 0 60px rgba(99, 102, 241, 0.15)',
            animation: 'pulse-glow 3s ease-in-out infinite',
          }}>
            <img src="/logo.jpg" alt="RobertApp" style={{
              width: '100%', height: '100%',
              borderRadius: '50%',
              objectFit: 'cover',
              display: 'block',
              border: '3px solid var(--color-bg-card)',
            }} />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4, letterSpacing: '-0.02em' }}>
            RobertApp
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Inicia sesión para acceder a tus finanzas
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'var(--color-danger-soft)', color: 'var(--color-danger)',
            padding: '10px 14px', borderRadius: 'var(--radius-sm)',
            fontSize: '0.82rem', marginBottom: 16, fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              Usuario
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input className="input" type="text" placeholder="Tu usuario" value={email}
                onChange={e => setEmail(e.target.value)} style={{ paddingLeft: 38 }} id="login-email" required />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input className="input" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                style={{ paddingLeft: 38, paddingRight: 40 }} id="login-password" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}
                aria-label={showPassword ? 'Ocultar' : 'Mostrar'}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} id="login-submit"
            style={{ width: '100%', padding: '12px 20px', fontSize: '0.95rem', fontWeight: 600, opacity: loading ? 0.7 : 1 }}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                Iniciando sesión...
              </span>
            ) : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 30px rgba(99, 102, 241, 0.4), 0 0 60px rgba(99, 102, 241, 0.15); }
          50% { box-shadow: 0 0 40px rgba(99, 102, 241, 0.6), 0 0 80px rgba(99, 102, 241, 0.25); }
        }
      `}</style>
    </div>
  )
}
