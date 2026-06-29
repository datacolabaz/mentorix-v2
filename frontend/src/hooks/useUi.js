import { create } from 'zustand'
import i18n, { readStoredLocale, writeStoredLocale, applyDocumentLocale, LOCALE_KEY } from '../i18n'

const THEME_KEY = 'mentorix_theme_v1'
const readTheme = () => {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

const writeTheme = (theme) => {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {}
}

/** Tema sinfi html + layout üzərində — input/select kontrastı üçün */
export function applyDocumentTheme(theme) {
  if (typeof document === 'undefined') return
  const next = theme === 'dark' ? 'dark' : 'light'
  const root = document.documentElement
  root.classList.remove('theme-light', 'theme-dark')
  root.classList.add(next === 'dark' ? 'theme-dark' : 'theme-light')
  root.style.colorScheme = next
}

const useUiStore = create((set, get) => ({
  focusMode: false,
  setFocusMode: (focusMode) => set({ focusMode: Boolean(focusMode) }),

  /** Modal/overlay açıq olanda sidebarı müvəqqəti gizlət (məzmun üstünə düşməsin). */
  overlayLock: false,
  setOverlayLock: (overlayLock) => set({ overlayLock: Boolean(overlayLock) }),

  theme: readTheme(), // light | dark (sidebar)
  setTheme: (theme) => {
    const next = theme === 'dark' ? 'dark' : 'light'
    writeTheme(next)
    applyDocumentTheme(next)
    set({ theme: next })
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    writeTheme(next)
    applyDocumentTheme(next)
    set({ theme: next })
  },

  locale: readStoredLocale(), // az | ru
  setLocale: (locale) => {
    const next = locale === 'ru' ? 'ru' : 'az'
    writeStoredLocale(next)
    applyDocumentLocale(next)
    void i18n.changeLanguage(next)
    set({ locale: next })
  },
}))

applyDocumentTheme(readTheme())

export default useUiStore

