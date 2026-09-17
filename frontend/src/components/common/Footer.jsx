import { createPortal } from 'react-dom'
import { useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { t } = useTranslation()
  const [leftOffset, setLeftOffset] = useState(0)

  useLayoutEffect(() => {
    const updateOffset = () => {
      const main = document.querySelector('main')
      if (!main) {
        setLeftOffset(0)
        return
      }
      setLeftOffset(Math.max(0, Math.round(main.getBoundingClientRect().left)))
    }

    updateOffset()
    window.addEventListener('resize', updateOffset)
    const main = document.querySelector('main')
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateOffset)
    if (main && observer) observer.observe(main)

    return () => {
      window.removeEventListener('resize', updateOffset)
      observer?.disconnect()
    }
  }, [])

  const footer = (
    <footer
      className="fixed right-0 bottom-0 z-[1000] border-t border-slate-200 bg-slate-50/95 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur-sm"
      style={{ left: `${leftOffset}px` }}
    >
      <div className="px-6 py-4 pr-16 sm:pr-20">
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
          <div className="text-left">{t('layout.footer.copyright')}</div>
          <div className="text-right">
            {t('layout.footer.poweredBy')}{' '}
            <a
              href="https://datacolab.az"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              DataColab
            </a>
          </div>
        </div>
      </div>
    </footer>
  )

  return typeof document === 'undefined' ? footer : createPortal(footer, document.body)
}
