import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { t } = useTranslation()

  const footer = (
    <footer className="fixed inset-x-0 bottom-0 z-[1000] w-full border-t border-white/10 bg-surface-2/95 shadow-[0_-4px_16px_rgba(0,0,0,0.12)]">
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
