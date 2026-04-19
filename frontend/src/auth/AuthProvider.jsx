import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getMe, login as apiLogin, setToken, getToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // hydrate from localStorage on mount
  useEffect(() => {
    const saved = window.localStorage.getItem('auth_token')
    if (saved) {
      setToken(saved)
    }
    ;(async () => {
      try {
        if (saved) {
          const me = await getMe()
          setUser(me)
        }
      } catch (e) {
        setToken(null)
        window.localStorage.removeItem('auth_token')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const login = useCallback(async (email, password) => {
    setError(null)
    const data = await apiLogin(email, password)
    const t = data.token
    setToken(t)
    window.localStorage.setItem('auth_token', t)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    window.localStorage.removeItem('auth_token')
  }, [])

  const value = useMemo(
    () => ({
      user,
      token: getToken(),
      loading,
      error,
      login,
      logout,
      setError,
      setUser,
    }),
    [user, loading, error, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

