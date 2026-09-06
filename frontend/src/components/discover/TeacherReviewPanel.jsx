import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Button from '../common/Button'
import { ratingStarsLine } from '../../lib/teacherMapCard'

export default function TeacherReviewPanel({ instructorId, instructor, isAuthenticated, onNeedAuth }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [eligibility, setEligibility] = useState(null)
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const publicLine = ratingStarsLine(instructor, t)

  useEffect(() => {
    if (!instructorId || !isAuthenticated) {
      setEligibility(null)
      return
    }
    let cancelled = false
    setLoading(true)
    api
      .get(`/students/teachers/${encodeURIComponent(instructorId)}/reviews/eligibility`)
      .then((d) => {
        if (cancelled) return
        setEligibility(d)
        if (d?.my_review?.rating) setRating(Number(d.my_review.rating) || 5)
        if (d?.my_review?.review_text) setText(String(d.my_review.review_text))
      })
      .catch(() => {
        if (!cancelled) setEligibility({ can_review: false })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [instructorId, isAuthenticated])

  const submit = async () => {
    if (!isAuthenticated) {
      onNeedAuth?.()
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await api.post(`/students/teachers/${encodeURIComponent(instructorId)}/reviews`, {
        rating,
        review_text: text,
      })
      setMessage(t('marketplace.reviews.saved'))
      const d = await api.get(`/students/teachers/${encodeURIComponent(instructorId)}/reviews/eligibility`)
      setEligibility(d)
    } catch (e) {
      setMessage(e?.message || t('marketplace.reviews.sendFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#121212]/95 p-5 sm:p-6">
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
        {t('marketplace.reviews.title')}
      </h2>

      {publicLine ? (
        <p className="text-sm font-semibold text-amber-200 mb-2">{publicLine}</p>
      ) : (
        <p className="text-sm text-gray-500 mb-2">{t('marketplace.reviews.empty')}</p>
      )}

      {instructor?.latest_review_snippet ? (
        <blockquote className="text-sm text-gray-400 border-l-2 border-white/15 pl-3 italic mb-4">
          “{instructor.latest_review_snippet}”
        </blockquote>
      ) : null}

      {!isAuthenticated ? (
        <p className="text-xs text-gray-500">{t('marketplace.reviews.loginToWrite')}</p>
      ) : loading ? (
        <p className="text-xs text-gray-500">{t('marketplace.reviews.checking')}</p>
      ) : eligibility?.can_review ? (
        <div className="space-y-3 mt-2">
          <label className="block text-xs text-gray-400">
            {t('marketplace.reviews.rating')}
            <select
              className="mt-1 w-full bg-[#13112e] border border-white/15 rounded-xl px-3 py-2 text-white text-sm"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {'⭐'.repeat(n)} ({n})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-gray-400">
            {t('marketplace.reviews.yourReview')}
            <textarea
              className="mt-1 w-full bg-[#13112e] border border-white/15 rounded-xl px-3 py-2 text-white text-sm min-h-[88px]"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('marketplace.reviews.placeholder')}
            />
          </label>
          <Button type="button" onClick={submit} disabled={busy}>
            {busy
              ? t('marketplace.reviews.sending')
              : eligibility?.my_review
                ? t('marketplace.reviews.update')
                : t('marketplace.reviews.submit')}
          </Button>
          {message ? <p className="text-xs text-emerald-400">{message}</p> : null}
        </div>
      ) : (
        <p className="text-xs text-gray-500 leading-relaxed">{t('marketplace.reviews.crmOnly')}</p>
      )}
    </section>
  )
}
