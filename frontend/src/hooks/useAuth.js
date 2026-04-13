import { create } from 'zustand'
import api from '../lib/api'

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('mx_user') || 'null'),
  token: localStorage.getItem('mx_token'),

  login: async (identifier, password) => {
    const data = await api.post('/auth/login', { identifier, password })
    localStorage.setItem('mx_token', data.token)
    localStorage.setItem('mx_user', JSON.stringify(data.user))
    set({ user: data.user, token: data.token })
    return data.user
  },

  phoneNextStep: async (phone, role) => api.post('/auth/phone/next-step', { phone, role }),

  forgotPinSms: async (phone, role) => api.post('/auth/pin/forgot-sms', { phone, role }),

  sendOtp: async (phone, role) => api.post('/auth/otp/send', { phone, role }),

  verifyOtp: async (phone, code, role, opts = {}) => {
    const body = { phone, code, role }
    if (opts.saveOtpAsPin === false) body.save_otp_as_pin = false
    if (opts.forgotPinReset === true) body.forgot_pin_reset = true
    const data = await api.post('/auth/otp/verify', body)
    localStorage.setItem('mx_token', data.token)
    localStorage.setItem('mx_user', JSON.stringify(data.user))
    set({ user: data.user, token: data.token })
    return data
  },

  pinLogin: async (phone, pin, role) => {
    const data = await api.post('/auth/pin/login', { phone, pin, role })
    localStorage.setItem('mx_token', data.token)
    localStorage.setItem('mx_user', JSON.stringify(data.user))
    set({ user: data.user, token: data.token })
    return data.user
  },

  setPin: async (pin) => api.post('/auth/pin/set', { pin }),

  logout: () => {
    localStorage.removeItem('mx_token')
    localStorage.removeItem('mx_user')
    set({ user: null, token: null })
  },
}))

export default useAuthStore
