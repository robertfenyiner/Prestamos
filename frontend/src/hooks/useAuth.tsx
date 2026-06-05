import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { authAPI } from '@/lib/api'

interface User {
  id: number
  name: string
  email: string
  role: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('prestamos-token')
  )
  const [loading, setLoading] = useState(true)

  // Restore session on mount
  useEffect(() => {
    if (token) {
      authAPI.me()
        .then(res => setUser(res.data.user))
        .catch(() => {
          localStorage.removeItem('prestamos-token')
          localStorage.removeItem('prestamos-user')
          setToken(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const res = await authAPI.login(email, password)
    const { token: newToken, user: userData } = res.data
    localStorage.setItem('prestamos-token', newToken)
    localStorage.setItem('prestamos-user', JSON.stringify(userData))
    setToken(newToken)
    setUser(userData)
  }

  const register = async (name: string, email: string, password: string) => {
    const res = await authAPI.register(name, email, password)
    const { token: newToken, user: userData } = res.data
    localStorage.setItem('prestamos-token', newToken)
    localStorage.setItem('prestamos-user', JSON.stringify(userData))
    setToken(newToken)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('prestamos-token')
    localStorage.removeItem('prestamos-user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user, token, loading, login, register, logout,
      isAuthenticated: !!token && !!user,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
