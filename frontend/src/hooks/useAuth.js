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

  sendMyPhoneVerifyOtp: async (phone) => api.post('/auth/phone/verify/send', { phone }),

  confirmMyPhoneVerifyOtp: async (phone, code) => {
    const data = await api.post('/auth/phone/verify/confirm', { phone, code })
    if (data?.user) {
      const token = localStorage.getItem('mx_token')
      localStorage.setItem('mx_user', JSON.stringify(data.user))
      set({ user: data.user, token })
    }
    return data
  },

  pinLogin: async (phone, pin, role) => {
    const data = await api.post('/auth/pin/login', { phone, pin, role })
    if (!data?.token || !data?.user) {
      throw Object.assign(new Error(data?.message || 'Server cavabı etibarsızdır'), {
        needs_setup: data?.needs_setup,
      })
    }
    localStorage.setItem('mx_token', data.token)
    localStorage.setItem('mx_user', JSON.stringify(data.user))
    set({ user: data.user, token: data.token })
    return data.user
  },

  googleLogin: async (credential) => {
    const data = await api.post('/auth/google/login', { credential })
    if (data?.token && data?.user) {
      localStorage.setItem('mx_token', data.token)
      localStorage.setItem('mx_user', JSON.stringify(data.user))
      set({ user: data.user, token: data.token })
    }
    return data
  },

  googleComplete: async (credential, role) => {
    const data = await api.post('/auth/google/complete', { credential, role })
    if (!data?.token || !data?.user) {
      throw new Error(data?.message || 'Server cavabı etibarsızdır')
    }
    localStorage.setItem('mx_token', data.token)
    localStorage.setItem('mx_user', JSON.stringify(data.user))
    set({ user: data.user, token: data.token })
    return data
  },

  setPin: async (pin) => api.post('/auth/pin/set', { pin }),

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
