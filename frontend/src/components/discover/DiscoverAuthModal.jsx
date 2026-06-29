import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Modal from '../common/Modal'

export default function DiscoverAuthModal({ open, onClose }) {
  const { t } = useTranslation()

  const saveReturn = () => {
    try {
      sessionStorage.setItem('mx_return_after_login', '/search')
    } catch {
      /* ignore */
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="" size="md" zIndex={10050}>
      <div className="px-6 pb-6 pt-2 text-center space-y-5">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-violet-500/20 border border-primary/30 flex items-center justify-center text-3xl shadow-lg shadow-primary/10">
          🔐
        </div>
        <div className="space-y-2">
          <h3 className="font-display text-xl font-bold text-white leading-snug">
            {t('marketplace.authModal.title')}
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed max-w-sm mx-auto">
            {t('marketplace.authModal.desc')}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          <Link
            to="/login"
            onClick={saveReturn}
            className="inline-flex justify-center items-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-[#041018] hover:brightness-95 shadow-lg shadow-primary/20"
          >
            {t('marketplace.authModal.registerLogin')}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex justify-center items-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-gray-300 hover:bg-white/10"
          >
            {t('marketplace.authModal.later')}
          </button>
        </div>
        <p className="text-[11px] text-gray-500">{t('marketplace.authModal.footer')}</p>
      </div>
    </Modal>
  )
}
