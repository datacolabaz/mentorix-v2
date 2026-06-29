import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="mt-10 border-t border-white/10 bg-surface-2/60">
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
}
