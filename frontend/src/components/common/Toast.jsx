import { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react'
import Modal from './Modal'
import Button from './Button'
import useUiStore from '../../hooks/useUi'

const ToastContext = createContext(null)

const DIALOG_TITLES = {
  success: 'Təsdiq',
  info: 'Məlumat',
  error: 'Xəta',
}

function messageClass(type, isDark) {
  if (type === 'success') return isDark ? 'text-emerald-300' : 'text-emerald-800'
  if (type === 'error') return isDark ? 'text-red-300' : 'text-red-700'
  if (type === 'info') return isDark ? 'text-sky-300' : 'text-sky-800'
  return isDark ? 'text-zinc-200' : 'text-slate-800'
}

export function ToastProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const theme = useUiStore((s) => s.theme)
  const isDark = theme === 'dark'

  const show = useCallback((msg, type = 'success') => {
    const text = String(msg ?? '').trim()
    if (!text) return

    setDialog({ msg: text, type })
  }, [])

  const api = useMemo(() => {
    const fn = (msg, type) => show(msg, type)
    fn.success = (msg) => show(msg, 'success')
    fn.error = (msg) => show(msg, 'error')
    fn.info = (msg) => show(msg, 'info')
    return fn
  }, [show])

  const closeDialog = useCallback(() => setDialog(null), [])

  useEffect(() => {
    if (!dialog) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') closeDialog()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, closeDialog])

  return (
    <ToastContext.Provider value={api}>
      {children}

      <Modal
        open={Boolean(dialog)}
        onClose={closeDialog}
        title={DIALOG_TITLES[dialog?.type] || (dialog?.type === 'error' ? 'Xəta' : 'Məlumat')}
        size="sm"
        zIndex={10150}
        footer={
          <div className="flex justify-center">
            <Button type="button" className="min-w-[120px] justify-center" onClick={closeDialog}>
              Tamam
            </Button>
          </div>
        }
      >
        <p className={`text-sm leading-relaxed text-center font-medium ${messageClass(dialog?.type, isDark)}`}>
          {dialog?.msg}
        </p>
      </Modal>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
