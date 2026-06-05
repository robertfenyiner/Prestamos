import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import DashboardPage from '@/modules/dashboard/DashboardPage'
import PrestamosPage from '@/modules/prestamos/PrestamosPage'
import ClientesPage from '@/modules/clientes/ClientesPage'
import SettingsPage from '@/modules/settings/SettingsPage'
import LoginPage from '@/modules/auth/LoginPage'
import { ThemeProvider } from '@/hooks/useTheme'
import { AuthProvider, useAuth } from '@/hooks/useAuth'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-primary)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--color-border)', borderTop: '3px solid var(--color-accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Cargando...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/" element={<Navigate to="/prestamos" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/prestamos" element={<PrestamosPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/gastos" element={<Navigate to="/prestamos" replace />} />
        <Route path="/reportes" element={<Navigate to="/prestamos" replace />} />
        <Route path="/ahorros" element={<Navigate to="/prestamos" replace />} />
        <Route path="/tarjetas" element={<Navigate to="/prestamos" replace />} />
        <Route path="/notificaciones" element={<Navigate to="/prestamos" replace />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  )
}
