import { create } from 'zustand'

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

const useUiStore = create((set, get) => ({
  focusMode: false,
  setFocusMode: (focusMode) => set({ focusMode: Boolean(focusMode) }),

  theme: readTheme(), // light | dark (sidebar)
  setTheme: (theme) => {
    const next = theme === 'dark' ? 'dark' : 'light'
    writeTheme(next)
    set({ theme: next })
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    writeTheme(next)
    set({ theme: next })
  },
}))

export default useUiStore

