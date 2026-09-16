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
      className="fixed right-0 bottom-0 z-[1000] border-t border-white/10 bg-surface-2/95 shadow-[0_-4px_16px_rgba(0,0,0,0.12)]"
      style={{ left: `${leftOffset}px` }}
    >
      <div className="px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/50">
          <div className="text-center sm:text-left">{t('layout.footer.copyright')}</div>
          <div className="text-center sm:text-right">
            {t('layout.footer.poweredBy')}{' '}
            <a
              href="https://datacolab.az"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-white/70 hover:text-white transition-colors"
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
