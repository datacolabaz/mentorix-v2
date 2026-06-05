import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Button from '../common/Button'
import { ratingStarsLine } from '../../lib/teacherMapCard'

export default function TeacherReviewPanel({ instructorId, instructor, isAuthenticated, onNeedAuth }) {
  const [loading, setLoading] = useState(false)
  const [eligibility, setEligibility] = useState(null)
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const publicLine = ratingStarsLine(instructor)

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
      setMessage('Rəyiniz yadda saxlanıldı. Təşəkkürlər!')
      const d = await api.get(`/students/teachers/${encodeURIComponent(instructorId)}/reviews/eligibility`)
      setEligibility(d)
    } catch (e) {
      setMessage(e?.message || 'Göndərilmədi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#121212]/95 p-5 sm:p-6">
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tələbə rəyləri</h2>

      {publicLine ? (
        <p className="text-sm font-semibold text-amber-200 mb-2">{publicLine}</p>
      ) : (
        <p className="text-sm text-gray-500 mb-2">Hələ rəy yoxdur.</p>
      )}

      {instructor?.latest_review_snippet ? (
        <blockquote className="text-sm text-gray-400 border-l-2 border-white/15 pl-3 italic mb-4">
          “{instructor.latest_review_snippet}”
        </blockquote>
      ) : null}

      {!isAuthenticated ? (
        <p className="text-xs text-gray-500">Rəy yazmaq üçün daxil olun.</p>
      ) : loading ? (
        <p className="text-xs text-gray-500">Yoxlanılır…</p>
      ) : eligibility?.can_review ? (
        <div className="space-y-3 mt-2">
          <label className="block text-xs text-gray-400">
            Reytinq
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
            Rəyiniz (min. 10 simvol)
            <textarea
              className="mt-1 w-full bg-[#13112e] border border-white/15 rounded-xl px-3 py-2 text-white text-sm min-h-[88px]"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Dərs təcrübənizi qısaca yazın…"
            />
          </label>
          <Button type="button" onClick={submit} disabled={busy}>
            {busy ? 'Göndərilir…' : eligibility?.my_review ? 'Rəyi yenilə' : 'Rəy göndər'}
          </Button>
          {message ? <p className="text-xs text-emerald-400">{message}</p> : null}
        </div>
      ) : (
        <p className="text-xs text-gray-500 leading-relaxed">
          Rəy yalnız təsdiqlənmiş CRM tələbələr üçündür — bu müəllimlə qrupda dərs almış və ya ödəniş
          etmiş olmalısınız. Qonaq imtahan iştirakçıları rəy yaza bilməz.
        </p>
      )}
    </section>
  )
}
