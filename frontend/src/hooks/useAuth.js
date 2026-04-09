import { create } from 'zustand'
import api from '../lib/api'

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('mx_user') || 'null'),
  token: localStorage.getItem('mx_token'),

  login: async (email, password) => {
    const data = await api.post('/auth/login', { email, password })
    localStorage.setItem('mx_token', data.token)
    localStorage.setItem('mx_user', JSON.stringify(data.user))
    set({ user: data.user, token: data.token })
    return data.user
  },

  sendOtp: async (phone) => {
    return api.post('/auth/otp/send', { phone })
  },

  verifyOtp: async (phone, code) => {
    const data = await api.post('/auth/otp/verify', { phone, code })
    localStorage.setItem('mx_token', data.token)
    localStorage.setItem('mx_user', JSON.stringify(data.user))
    set({ user: data.user, token: data.token })
    return data.user
  },

  logout: () => {
    localStorage.clear()
    set({ user: null, token: null })
  },
}))

export default useAuthStore
