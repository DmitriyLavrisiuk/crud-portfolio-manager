import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { apiFetch } from '@/lib/api'

type User = {
  id: string
  email: string
  role: string
}

type AuthResponse = {
  user: User
  accessToken: string
}

type AuthContextValue = {
  user: User | null
  accessToken: string | null
  isInitializing: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/refresh`,
        {
          method: 'POST',
          credentials: 'include',
        },
      )
      if (response.status === 401) {
        setUser(null)
        setAccessToken(null)
        return null
      }
      if (!response.ok) {
        setUser(null)
        setAccessToken(null)
        if (response.status >= 500) {
          console.error('Auth refresh failed with a server error.')
        }
        return null
      }
      const data = (await response.json()) as AuthResponse
      setUser(data.user)
      setAccessToken(data.accessToken)
      return data.accessToken
    } catch {
      setUser(null)
      setAccessToken(null)
      console.error('Auth refresh failed due to a network error.')
      return null
    }
  }, [])

  useEffect(() => {
    let isActive = true
    const bootstrap = async () => {
      const token = await refresh()
      if (isActive) {
        if (!token) {
          setUser(null)
          setAccessToken(null)
        }
        setIsInitializing(false)
      }
    }
    bootstrap()
    return () => {
      isActive = false
    }
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setUser(data.user)
    setAccessToken(data.accessToken)
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setUser(data.user)
    setAccessToken(data.accessToken)
  }, [])

  const logout = useCallback(async () => {
    await apiFetch<{ ok: true }>('/auth/logout', {
      method: 'POST',
      accessToken,
      onUnauthorized: refresh,
    })
    setUser(null)
    setAccessToken(null)
  }, [accessToken, refresh])

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isInitializing,
      isAuthenticated: Boolean(user && accessToken),
      login,
      register,
      logout,
      refresh,
    }),
    [user, accessToken, isInitializing, login, register, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
