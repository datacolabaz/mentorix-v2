import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from './Modal'
import Button from './Button'
import { useToast } from './Toast'

export default function BookingModal({ isOpen, onClose, mentorName = 'Mentor', onBookSuccess }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Form State
  const [goalType, setGoalType] = useState('career')
  const [questions, setQuestions] = useState('')
  const [links, setLinks] = useState('')
  const [format, setFormat] = useState('30')
  const [selectedDate, setSelectedDate] = useState('2026-10-15')
  const [selectedSlot, setSelectedSlot] = useState('18:00')
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const slots = ['15:00', '16:30', '18:00', '19:30', '21:00']

  const handleNext = () => {
    if (step === 1) {
      if (!questions.trim()) {
        toast('Müzakirə olunacaq sualları qeyd edin', 'error')
        return
      }
      setStep(2)
    } else if (step === 2) {
      if (!selectedSlot) {
        toast('Görüş vaxtı slotunu seçin', 'error')
        return
      }
      setStep(3)
    }
  }

  const handleSubmit = async () => {
    if (!acceptedTerms) {
      toast('Məxfilik və etik qaydaları qəbul etməlisiniz', 'error')
      return
    }
    setLoading(true)
    try {
      await new Promise((r) => setTimeout(r, 600))
      toast(`Görüş sorğusu ${mentorName} mentoruna göndərildi!`, 'success')
      if (onBookSuccess) onBookSuccess()
      handleClose()
    } catch {
      toast('Görüş sorğusu göndərilə bilmədi', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep(1)
    setQuestions('')
    setLinks('')
    setAcceptedTerms(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="1-ə-1 Mentor Sessiyası Təyin Et">
      <div className="space-y-5">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-token-border pb-3">
          <div className="text-xs font-bold uppercase tracking-wider text-token-textMuted">
            {step === 1 && 'Addım 1 / 3: Görüşün Məqsədi'}
            {step === 2 && 'Addım 2 / 3: Tarix, Vaxt və Format'}
            {step === 3 && 'Addım 3 / 3: Məxfilik və Təsdiq'}
          </div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
            {mentorName} ilə
          </span>
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-token-textMuted mb-1.5 uppercase tracking-wider">
                Görüşün Əsas Məqsədi
              </label>
              <select
                value={goalType}
                onChange={(e) => setGoalType(e.target.value)}
                className="w-full rounded-xl border border-token-border bg-token-surface px-3.5 py-2.5 text-sm text-token-text outline-none focus:border-primary"
              >
                <option value="career">Karyera Planlaması və Yol Xəritəsi</option>
                <option value="skills">Bacarıq Yönümlü İnkişaf (Skills-Based)</option>
                <option value="cv_review">CV və Portfolio Rəyi (Feedback)</option>
                <option value="code_review">Kod və Texniki Memarlıq Təhlili</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-token-textMuted mb-1.5 uppercase tracking-wider">
                Müzakirə Olunacaq 2-3 Ana Sual <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={questions}
                onChange={(e) => setQuestions(e.target.value)}
                placeholder="1. Junior rola keçid üçün portfoliomda nə çatışmır?&#10;2. Texniki müsahibəyə necə hazırlaşmalıyam?"
                className="w-full rounded-xl border border-token-border bg-token-surface p-3 text-sm text-token-text outline-none focus:border-primary placeholder:text-token-textMuted"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-token-textMuted mb-1.5 uppercase tracking-wider">
                Fayl və ya Linklər (LinkedIn / GitHub / CV)
              </label>
              <input
                type="text"
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                placeholder="https://linkedin.com/in/... və ya portfolio linki"
                className="w-full rounded-xl border border-token-border bg-token-surface px-3.5 py-2.5 text-sm text-token-text outline-none focus:border-primary placeholder:text-token-textMuted"
              />
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-token-textMuted mb-1.5 uppercase tracking-wider">
                Sessiya Formatı
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '15', title: '15 dəq', desc: 'Tanışlıq' },
                  { id: '30', title: '30 dəq', desc: 'Aktiv sessiya' },
                  { id: '60', title: '60 dəq', desc: 'Dərin təhlil' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id)}
                    className={[
                      'p-2.5 rounded-xl border text-center transition-all',
                      format === f.id
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-token-border bg-token-surface hover:bg-token-surfaceHover text-token-text',
                    ].join(' ')}
                  >
                    <div className="font-bold text-xs">{f.title}</div>
                    <div className="text-[10px] text-token-textMuted mt-0.5">{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-token-textMuted mb-1.5 uppercase tracking-wider">
                Mövcud Saat Slotları (Bakı Vaxtı: UTC+4)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSlot(s)}
                    className={[
                      'py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center',
                      selectedSlot === s
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500'
                        : 'border-token-border bg-token-surface hover:bg-token-surfaceHover text-token-text',
                    ].join(' ')}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/70 dark:bg-blue-950/30 dark:border-blue-800/40 text-xs text-blue-900 dark:text-blue-300">
              💡 Görüş təsdiqləndikdən sonra avtomatik <strong>Google Meet / Zoom</strong> keçid linki yaranacaq və təqviminizə əlavə olunacaq.
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-token-border bg-token-surfaceHover/30 space-y-2 text-xs text-token-text">
              <div className="flex justify-between">
                <span className="text-token-textMuted">Mentor:</span>
                <span className="font-bold">{mentorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-token-textMuted">Müddət:</span>
                <span className="font-bold">{format} dəqiqə</span>
              </div>
              <div className="flex justify-between">
                <span className="text-token-textMuted">Seçilmiş Vaxt:</span>
                <span className="font-bold">{selectedDate} · {selectedSlot}</span>
              </div>
            </div>

            {/* EMCC Code of Ethics & Confidentiality */}
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800/40 space-y-2">
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="emcc_terms"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 rounded border-amber-300 text-primary focus:ring-primary"
                />
                <label htmlFor="emcc_terms" className="text-xs text-amber-950 dark:text-amber-200 leading-relaxed cursor-pointer">
                  <strong>EMCC Məxfilik və Etika Razılaşması:</strong> Sessiya zamanı paylaşılan şəxsi və peşəkar məlumatların gizli saxlanılacağını və beynəlxalq mentorluq etik qaydalarına riayət edəcəyimi qəbul edirəm.
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-token-border">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="text-xs font-semibold text-token-textMuted hover:text-token-text px-3 py-2"
            >
              ← Geri
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="text-xs font-semibold text-token-textMuted hover:text-token-text px-3 py-2"
            >
              Ləğv et
            </button>
          )}

          {step < 3 ? (
            <Button onClick={handleNext}>
              Növbəti Addım →
            </Button>
          ) : (
            <Button
              loading={loading}
              disabled={!acceptedTerms}
              onClick={handleSubmit}
            >
              Görüş Sorğusu Göndər 🚀
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
