import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/client'

interface User {
  id: string
  email: string
  name: string
  role: 'director' | 'manager' | 'engineer'
  avatar?: string
  avatar_url?: string
  show_avatar?: boolean
  permissions: Record<string, boolean>
  notification_settings: Record<string, boolean>
}

interface Client {
  id: string
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone: string
}

interface AuthContextType {
  user: User | null
  client: Client | null
  token: string | null
  loginUser: (email: string, password: string) => Promise<void>
  loginClient: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    const savedClient = localStorage.getItem('client')
    if (savedUser) setUser(JSON.parse(savedUser))
    if (savedClient) setClient(JSON.parse(savedClient))
    setIsLoading(false)
  }, [])

  const loginUser = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    localStorage.removeItem('client')
    setToken(data.token)
    setUser(data.user)
    setClient(null)
  }

  const loginClient = async (email: string, password: string) => {
    const { data } = await api.post('/auth/client/login', { email, password })
    localStorage.setItem('token', data.token)
    localStorage.setItem('client', JSON.stringify(data.client))
    localStorage.removeItem('user')
    setToken(data.token)
    setClient(data.client)
    setUser(null)
  }

  const refreshUser = async () => {
    try {
      const { data } = await api.get('/users/me')
      setUser(data)
      localStorage.setItem('user', JSON.stringify(data))
    } catch {}
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('client')
    setToken(null)
    setUser(null)
    setClient(null)
  }

  return (
    <AuthContext.Provider value={{ user, client, token, loginUser, loginClient, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
