import { create } from 'zustand'
import api from '../lib/api'
import { trackLogout } from '../lib/analytics'
import { consumeReturnAfterLogin } from '../lib/inviteReturn'

function clearDiscoverReminderOnAuth(user) {
  const id = user?.id
  if (!id) return
  try {
    sessionStorage.removeItem(`mx_discover_modal_v1_${id}`)
  } catch {
    /* ignore */
  }
}

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
        const nextToken = data.token || token
        if (data.token) localStorage.setItem('mx_token', data.token)
        localStorage.setItem('mx_user', JSON.stringify(data.user))
        set({ user: data.user, token: nextToken })
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

  setSession: (token, user) => {
    if (!token || !user) return
    localStorage.setItem('mx_token', token)
    localStorage.setItem('mx_user', JSON.stringify(user))
    clearDiscoverReminderOnAuth(user)
    set({ user, token })
  },

  switchWorkspace: async (target) => {
    const data = await api.post('/auth/switch-workspace', { target })
    if (!data?.token || !data?.user) {
      throw new Error(data?.message || 'Kabinet dəyişdirilə bilmədi')
    }
    localStorage.setItem('mx_token', data.token)
    localStorage.setItem('mx_user', JSON.stringify(data.user))
    localStorage.setItem('mx_active_workspace', String(target || '').toLowerCase())
    window.dispatchEvent(new CustomEvent('mx:workspace-switched', { detail: String(target || '').toLowerCase() }))
    set({ user: data.user, token: data.token })
    return data
  },

  logout: () => {
    trackLogout()
    const uid = JSON.parse(localStorage.getItem('mx_user') || 'null')?.id
    if (uid) {
      try {
        sessionStorage.removeItem(`mx_discover_modal_v1_${uid}`)
      } catch {
        /* ignore */
      }
    }
    // Sticky ?next= / return URL (məs. /partner/dashboard) növbəti girişdə digər persona-ya yapışmasın.
    consumeReturnAfterLogin()
    try {
      sessionStorage.removeItem('mx_role_panel_override')
    } catch {
      /* ignore */
    }
    localStorage.removeItem('mx_token')
    localStorage.removeItem('mx_user')
    localStorage.removeItem('mx_active_workspace')
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
