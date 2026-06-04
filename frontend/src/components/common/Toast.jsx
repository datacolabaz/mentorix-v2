import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import Modal from './Modal'
import Button from './Button'

const ToastContext = createContext(null)

const TOAST_COLORS = {
  success: 'border-emerald-500/30 text-emerald-400',
  error: 'border-red-500/30 text-red-400',
  info: 'border-primary/30 text-primary',
}

const DIALOG_TITLES = {
  success: 'Təsdiq',
  info: 'Məlumat',
}

/** Uğurlu / məlumat mesajları — mərkəzdə dialoq; xətalar — sağ altda toast */
function usesCenterDialog(type) {
  return type === 'success' || type === 'info'
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dialog, setDialog] = useState(null)

  const show = useCallback((msg, type = 'success') => {
    const text = String(msg ?? '').trim()
    if (!text) return

    if (usesCenterDialog(type)) {
      setDialog({ msg: text, type })
      return
    }

    const id = Date.now()
    setToasts((prev) => [...prev, { id, msg: text, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

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
    <ToastContext.Provider value={show}>
      {children}

      <Modal
        open={Boolean(dialog)}
        onClose={closeDialog}
        title={DIALOG_TITLES[dialog?.type] || 'Təsdiq'}
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
        <p
          className={`text-sm leading-relaxed text-center ${
            dialog?.type === 'success'
              ? 'text-emerald-300/95'
              : dialog?.type === 'info'
                ? 'text-primary/95'
                : 'text-zinc-200'
          }`}
        >
          {dialog?.msg}
        </p>
      </Modal>

      <div className="fixed bottom-6 right-6 z-[10100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto bg-surface-2 border rounded-xl px-4 py-3 text-sm font-semibold shadow-xl animate-fade-up max-w-[min(100vw-3rem,22rem)] ${TOAST_COLORS[t.type] || TOAST_COLORS.error}`}
            role="alert"
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
