import { create } from 'zustand'
import api from '../lib/api'

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('mx_user') || 'null'),
  token: localStorage.getItem('mx_token'),

  /** Token varsa /auth/me ilə təsdiq; yalnız 401/403-da yaddaşı təmizlə (şəbəkə xətasında girişi sındırma) */
  bootstrapSession: async () => {
    const token = localStorage.getItem('mx_token')
    if (!token) {
      localStorage.removeItem('mx_user')
      set({ user: null, token: null })
      return
    }
    try {
      const data = await api.get('/auth/me')
      if (data?.user) {
        localStorage.setItem('mx_user', JSON.stringify(data.user))
        set({ user: data.user, token })
      } else {
        throw new Error('no user')
      }
    } catch (e) {
      const st = e?.status ?? e?.response?.status
      if (st === 401 || st === 403) {
        localStorage.removeItem('mx_token')
        localStorage.removeItem('mx_user')
        set({ user: null, token: null })
      }
    }
  },

  login: async (identifier, password) => {
    const data = await api.post('/auth/login', { identifier, password })
    if (!data?.token || !data?.user) {
      throw new Error(data?.message || 'Server cavabı etibarsızdır')
    }
    localStorage.setItem('mx_token', data.token)
    localStorage.setItem('mx_user', JSON.stringify(data.user))
    set({ user: data.user, token: data.token })
    return data.user
  },

  signupWithEmail: async (body) => api.post('/auth/signup', body),

  loginWithEmail: async ({ email, password, role = 'instructor' }) => {
    const data = await api.post('/auth/login/email', { email, password, role })
    if (!data?.token || !data?.user) {
      const err = new Error(data?.message || 'Server cavabı etibarsızdır')
      err.code = data?.code
      throw err
    }
    localStorage.setItem('mx_token', data.token)
    localStorage.setItem('mx_user', JSON.stringify(data.user))
    set({ user: data.user, token: data.token })
    return data.user
  },

  verifyEmailCode: async ({ email, code }) => api.post('/auth/verify-email', { email, code }),

  resendVerificationEmail: async (email) => api.post('/auth/resend-verification', { email }),

  setSession: (token, user) => {
    if (!token || !user) return
    localStorage.setItem('mx_token', token)
    localStorage.setItem('mx_user', JSON.stringify(user))
    set({ user, token })
  },

  logout: () => {
    localStorage.removeItem('mx_token')
    localStorage.removeItem('mx_user')
    set({ user: null, token: null })
  },

  updateUser: (patch) =>
    set((state) => {
      if (!state.user || !patch || typeof patch !== 'object') return state
      const user = { ...state.user, ...patch }
      localStorage.setItem('mx_user', JSON.stringify(user))
      return { user }
    }),
}))

export default useAuthStore
