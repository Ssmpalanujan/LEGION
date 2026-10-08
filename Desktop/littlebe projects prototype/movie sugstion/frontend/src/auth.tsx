import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'

interface User {
  id: number
  email: string
  is_admin: boolean
}

interface AuthCtx {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('cm_access'))
  const [user, setUser] = useState<User | null>(null)

  const logout = useCallback(() => {
    localStorage.removeItem('cm_access')
    localStorage.removeItem('cm_refresh')
    setToken(null)
    setUser(null)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const me = await api.me()
      setUser(me)
    } catch {
      logout()
    }
  }, [logout])

  useEffect(() => {
    if (token) void refresh()
  }, [token, refresh])

  const persist = (access: string, refreshTok: string) => {
    localStorage.setItem('cm_access', access)
    localStorage.setItem('cm_refresh', refreshTok)
    setToken(access)
  }

  const login = async (email: string, password: string) => {
    const t = await api.login(email, password)
    persist(t.access_token, t.refresh_token)
    await refresh()
  }
  const register = async (email: string, password: string) => {
    const t = await api.register(email, password)
    persist(t.access_token, t.refresh_token)
    await refresh()
  }

  return <Ctx.Provider value={{ user, token, login, register, logout, refresh }}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside provider')
  return v
}
