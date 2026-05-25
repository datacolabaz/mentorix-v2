import { useEffect } from 'react'

export default function Modal({ open, onClose, title, children, size = 'md', zIndex = 250 }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      style={{ zIndex }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`theme-dark bg-surface-2 border border-white/10 rounded-2xl w-full ${sizes[size]} max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="font-display font-700 text-lg text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl"
          >
            ✕
          </button>
        </div>
        <div className="p-6 text-zinc-200">{children}</div>
      </div>
    </div>
  )
}
