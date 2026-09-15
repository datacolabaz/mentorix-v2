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

function DialogTitle({ type }) {
  const label = DIALOG_TITLES[type] || 'Məlumat'
  const iconClass = type === 'error'
    ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
    : type === 'success'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
      : 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'

  return (
    <span className="flex items-center gap-2.5">
      <span className={`grid h-7 w-7 place-items-center rounded-full ${iconClass}`} aria-hidden="true">
        {type === 'error' ? '!' : type === 'success' ? '✓' : 'i'}
      </span>
      {label}
    </span>
  )
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
        title={<DialogTitle type={dialog?.type} />}
        size="sm"
        zIndex={10150}
        compact
        footer={
          <div className="flex justify-center">
            <Button
              type="button"
              variant={dialog?.type === 'error' ? 'secondary' : 'primary'}
              className="min-w-[108px] justify-center"
              onClick={closeDialog}
            >
              Bağla
            </Button>
          </div>
        }
      >
        <p className={`text-sm leading-6 text-center font-medium ${messageClass(dialog?.type, isDark)}`}>
          {dialog?.msg}
        </p>
      </Modal>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
