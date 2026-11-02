/**
 * Auth disederhanakan — tidak ada login/logout.
 * User ID di-hardcode via environment variable atau konstanta.
 */
import { createContext, useContext } from 'react'
import { USER_ID } from '../lib/user'

const AuthContext = createContext(null)

// User object statis — tidak perlu network call
const STATIC_USER = { id: USER_ID }

export function AuthProvider({ children }) {
  return (
    <AuthContext.Provider value={{ user: STATIC_USER }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return ctx
}
