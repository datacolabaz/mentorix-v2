import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import Modal from './Modal'
import Button from './Button'

const ToastContext = createContext(null)

const DIALOG_TITLES = {
  success: 'Təsdiq',
  info: 'Məlumat',
  error: 'Xəta',
}

export function ToastProvider({ children }) {
  const [dialog, setDialog] = useState(null)

  const show = useCallback((msg, type = 'success') => {
    const text = String(msg ?? '').trim()
    if (!text) return

    setDialog({ msg: text, type })
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
        <p
          className={`text-sm leading-relaxed text-center ${
            dialog?.type === 'success'
              ? 'text-emerald-300/95'
              : dialog?.type === 'error'
                ? 'text-red-300/95'
                : dialog?.type === 'info'
                  ? 'text-primary/95'
                  : 'text-zinc-200'
          }`}
        >
          {dialog?.msg}
        </p>
      </Modal>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
