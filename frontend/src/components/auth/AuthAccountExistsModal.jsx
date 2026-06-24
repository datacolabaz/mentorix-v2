import { useNavigate } from 'react-router-dom'
import Modal from '../common/Modal'

export default function AuthAccountExistsModal({ open, onClose, message }) {
  const navigate = useNavigate()

  const goLogin = () => {
    onClose?.()
    navigate('/login')
  }

  return (
    <Modal open={open} onClose={onClose} title="Hesab artıq mövcuddur" size="sm" zIndex={10050}>
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-2xl">
          ⚠️
        </div>
        <p className="text-sm text-gray-300 leading-relaxed">
          {message ||
            'Bu email artıq qeydiyyatdadır. Zəhmət olmasa «Daxil ol» bölməsindən giriş edin.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          <button
            type="button"
            onClick={goLogin}
            className="inline-flex justify-center items-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-[#041018] hover:brightness-95"
          >
            Daxil ol
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex justify-center items-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-gray-300 hover:bg-white/10"
          >
            Bağla
          </button>
        </div>
      </div>
    </Modal>
  )
}
