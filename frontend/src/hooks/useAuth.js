import { create } from 'zustand'
import api from '../lib/api'
import { trackLogout } from '../lib/analytics'
import { consumeReturnAfterLogin } from '../lib/inviteReturn'
import { safeLocalStorage, safeSessionStorage } from '../lib/safeStorage'

function clearDiscoverReminderOnAuth(user) {
  const id = user?.id
  if (!id) return
  safeSessionStorage.removeItem(`mx_discover_modal_v1_${id}`)
}

const useAuthStore = create((set) => ({
  user: safeLocalStorage.getJSON('mx_user', null),
  token: safeLocalStorage.getItem('mx_token'),

  /** Token varsa /auth/me ilə təsdiq; yalnız 401/403-da yaddaşı təmizlə (şəbəkə xətasında girişi sındırma) */
  bootstrapSession: async () => {
    const token = safeLocalStorage.getItem('mx_token')
    if (!token) {
      safeLocalStorage.removeItem('mx_user')
      set({ user: null, token: null })
      return
    }
    try {
      const data = await api.get('/auth/me')
      if (data?.user) {
        const nextToken = data.token || token
        if (data.token) safeLocalStorage.setItem('mx_token', data.token)
        safeLocalStorage.setJSON('mx_user', data.user)
        set({ user: data.user, token: nextToken })
      } else {
        throw new Error('no user')
      }
    } catch (e) {
      const st = e?.status ?? e?.response?.status
      if (st === 401 || st === 403) {
        safeLocalStorage.removeItem('mx_token')
        safeLocalStorage.removeItem('mx_user')
        set({ user: null, token: null })
      }
    }
  },

  setSession: (token, user) => {
    if (!token || !user) return
    safeLocalStorage.setItem('mx_token', token)
    safeLocalStorage.setJSON('mx_user', user)
    clearDiscoverReminderOnAuth(user)
    set({ user, token })
  },

  /** Server-provided user refresh without a new session token (e.g. a role request was created). */
  mergeUser: (patch) => {
    if (!patch || typeof patch !== 'object') return
    set((state) => {
      if (!state.user) return {}
      const next = { ...state.user, ...patch, role: state.user.role }
      safeLocalStorage.setJSON('mx_user', next)
      return { user: next }
    })
  },

  switchWorkspace: async (target, { organizationId } = {}) => {
    const body = organizationId ? { target, organization_id: organizationId } : { target }
    const data = await api.post('/auth/switch-workspace', body)
    if (data?.pending_approval) {
      // Teacher access needs approval: no cabinet switch, only the request status is refreshed.
      if (data.user) useAuthStore.getState().mergeUser(data.user)
      return data
    }
    if (!data?.token || !data?.user) {
      throw new Error(data?.message || 'Kabinet dəyişdirilə bilmədi')
    }
    safeLocalStorage.setItem('mx_token', data.token)
    safeLocalStorage.setJSON('mx_user', data.user)
    safeLocalStorage.setItem('mx_active_workspace', String(target || '').toLowerCase())
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mx:workspace-switched', { detail: String(target || '').toLowerCase() }))
    }
    set({ user: data.user, token: data.token })
    return data
  },

  logout: () => {
    trackLogout()
    const uid = safeLocalStorage.getJSON('mx_user', null)?.id
    if (uid) {
      safeSessionStorage.removeItem(`mx_discover_modal_v1_${uid}`)
    }
    // Sticky ?next= / return URL (məs. /partner/dashboard) növbəti girişdə digər persona-ya yapışmasın.
    consumeReturnAfterLogin()
    safeSessionStorage.removeItem('mx_role_panel_override')
    safeLocalStorage.removeItem('mx_token')
    safeLocalStorage.removeItem('mx_user')
    safeLocalStorage.removeItem('mx_active_workspace')
    set({ user: null, token: null })
  },

  updateUser: (patch) =>
    set((state) => {
      if (!state.user || !patch || typeof patch !== 'object') return state
      const user = { ...state.user, ...patch }
      safeLocalStorage.setJSON('mx_user', user)
      return { user }
    }),
}))

export default useAuthStore
