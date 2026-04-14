import { create } from 'zustand'

const useUiStore = create((set) => ({
  focusMode: false,
  setFocusMode: (focusMode) => set({ focusMode: Boolean(focusMode) }),
}))

export default useUiStore

