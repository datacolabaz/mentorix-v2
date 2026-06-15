import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import InstructorAvatar from '../common/InstructorAvatar'
import { formatDistanceKm } from '../../lib/geo'

const EXAMPLE =
  'Məs: Övladım riyaziyyatdan zəifdir, 8-ci sinifdir, Yasamaldadır'

function StepBadge({ n, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
        {n}
      </span>
      <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">{label}</span>
    </div>
  )
}

function TutorMiniCard({ tutor, onInquiry, onWhatsApp, onFocus, whatsappBusy }) {
  const rate = tutor.discover_hourly_rate != null ? `${tutor.discover_hourly_rate} ₼/saat` : null
  return (
    <div className="rounded-xl border border-white/10 bg-[#121212]/90 p-3 space-y-2">
      <button type="button" onClick={() => onFocus?.(tutor)} className="flex w-full gap-2.5 text-left min-w-0">
        <InstructorAvatar
          fullName={tutor.full_name}
          avatarUrl={tutor.avatar_url}
          size="sm"
          kind={tutor.map_profile_kind}
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{tutor.full_name}</p>
          <p className="text-[11px] text-gray-400 truncate">
            {tutor.category_names?.join(', ') || tutor.subject}
            {rate ? ` · ${rate}` : ''}
            {tutor.distance_km != null ? ` · ${formatDistanceKm(tutor.distance_km)}` : ''}
          </p>
        </div>
      </button>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onInquiry?.(tutor)}
          className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30"
        >
          Sınaq dərsi
        </button>
        <button
          type="button"
          onClick={() => onInquiry?.(tutor)}
          className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-white/15 text-gray-300 hover:border-white/30"
        >
          Mesaj
        </button>
        <button
          type="button"
          disabled={whatsappBusy}
          onClick={() => onWhatsApp?.(tutor)}
          className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
        >
          WhatsApp
        </button>
      </div>
    </div>
  )
}

export default function MarketplaceAiSearchPanel({
  userLat,
  userLng,
  onApplyFilters,
  onInquiry,
  onWhatsApp,
  onFocusTutor,
  whatsappBusy,
}) {
  const [query, setQuery] = useState('')
  const [forChild, setForChild] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [expanded, setExpanded] = useState(true)

  const runSearch = async () => {
    const q = query.trim()
    if (q.length < 6) {
      setError('Ən azı 6 simvol yazın.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/public/marketplace/ai-search', {
        query: q,
        for_child: forChild,
        lat: userLat ?? null,
        lng: userLng ?? null,
      })
      if (!res?.success) {
        setError(res?.message || 'Axtarış alınmadı')
        setResult(null)
        return
      }
      setResult(res)
      setExpanded(true)
      const ex = res.extracted || {}
      onApplyFilters?.({
        category_id: ex.category_id || null,
        category_slug: ex.category_slug || null,
        category_name: ex.subject && ex.category_id ? ex.subject : null,
        area_id: ex.area_id || null,
      })
    } catch (e) {
      setError(e?.message || 'Xəta')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const extracted = result?.extracted
  const tutors = result?.step1_tutors
  const tutorMatches = tutors?.matches || []
  const hasTutorMatches = tutorMatches.length > 0
  const isEmptyResult = Boolean(result) && (Boolean(tutors?.empty_state) || !hasTutorMatches)
  const pricing = !isEmptyResult ? result?.step2_pricing : null
  const curriculum = !isEmptyResult ? result?.step3_curriculum : null
  const cta = !isEmptyResult ? result?.step4_cta : null

  return (
    <section className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-[#14101f] to-[#0f0f0f] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-white/[0.03]"
      >
        <div>
          <p className="text-sm font-bold text-white">AI ilə müəllim tap</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Təbii dildə yazın — uyğun müəllim, qiymət və dərs planı</p>
        </div>
        <span className="text-gray-500 text-xs shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded ? (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={forChild}
              onChange={(e) => setForChild(e.target.checked)}
              className="rounded border-white/20 bg-[#1a1a1a] text-primary focus:ring-primary/40"
            />
            <span className="text-xs text-gray-300">Övladım üçün axtarıram</span>
          </label>

          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={EXAMPLE}
            rows={3}
            className="w-full rounded-xl border border-white/15 bg-[#0b0b0b]/80 px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-primary/50 focus:outline-none resize-none"
          />

          <button
            type="button"
            disabled={loading}
            onClick={() => void runSearch()}
            className="w-full rounded-xl bg-primary hover:brightness-110 disabled:opacity-60 text-[#0b0b0b] font-bold text-sm py-2.5 transition-all"
          >
            {loading ? 'Analiz edilir…' : 'Axtar'}
          </button>

          {error ? <p className="text-xs text-red-400">{error}</p> : null}

          {extracted ? (
            <div className="flex flex-wrap gap-1.5">
              {extracted.subject ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                  {extracted.subject}
                </span>
              ) : null}
              {extracted.grade ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                  {extracted.grade}
                </span>
              ) : null}
              {extracted.location ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                  {extracted.location}
                </span>
              ) : null}
              {extracted.student_level ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
                  {extracted.student_level}
                </span>
              ) : null}
            </div>
          ) : null}

          {result ? (
            <div className="space-y-4 pt-1">
              <div className="space-y-2">
                <StepBadge n={1} label="Uyğun müəllimlər" />
                {isEmptyResult ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                    <p className="text-sm font-semibold text-white">
                      {tutors?.empty_state?.title || 'Uyğun müəllim tapılmadı'}
                    </p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {tutors?.empty_state?.message ||
                        'Bu axtarış üzrə dəqiq uyğun profil yoxdur. Aşağıdakı xəritə və siyahıdan digər müəllimlərə baxa bilərsiniz.'}
                    </p>
                    <p className="text-xs text-primary/90 font-medium pt-1">
                      ↓ Aşağıdakı xəritə və siyahıdan müəllim seçin
                    </p>
                    {tutors?.empty_state?.instructor_cta ? (
                      <Link
                        to={tutors.empty_state.instructor_cta.path}
                        className="inline-block text-xs font-bold text-primary hover:underline"
                      >
                        {tutors.empty_state.instructor_cta.label} →
                      </Link>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tutors?.match_note ? (
                      <p className="text-[11px] text-amber-300/90 leading-relaxed">{tutors.match_note}</p>
                    ) : null}
                    <p className="text-[11px] text-gray-500">
                      {tutors?.count ?? 0} nəticədən ən yaxşı {tutors?.matches?.length ?? 0}
                    </p>
                    {(tutors?.matches || []).map((t) => (
                      <TutorMiniCard
                        key={String(t.id)}
                        tutor={t}
                        onInquiry={onInquiry}
                        onWhatsApp={onWhatsApp}
                        onFocus={onFocusTutor}
                        whatsappBusy={whatsappBusy}
                      />
                    ))}
                  </div>
                )}
              </div>

              {pricing ? (
                <div className="space-y-2">
                  <StepBadge n={2} label="Təxmini qiymət" />
                  <div className="rounded-xl border border-white/10 bg-[#121212]/80 p-3 text-xs space-y-2">
                    <p className="text-[10px] text-emerald-400/90 font-semibold">
                      {tutorMatches.length === 1
                        ? `${tutorMatches[0].full_name} profilinə əsasən`
                        : `${tutorMatches.length} uyğun müəllimin tarifinə əsasən`}
                    </p>
                    <p className="text-white font-semibold">
                      Dərs başına: <span className="text-primary">{pricing.per_lesson_azn_range} ₼</span>
                      {pricing.per_lesson_typical_azn ? (
                        <span className="text-gray-400 font-normal"> (orta ~{pricing.per_lesson_typical_azn} ₼)</span>
                      ) : null}
                    </p>
                    <ul className="space-y-1 text-gray-400">
                      {(pricing.packages || []).map((pkg) => (
                        <li key={pkg.type}>
                          {pkg.label}: <span className="text-gray-200">{pkg.total_azn} ₼</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-gray-500 leading-relaxed">{pricing.marketplace_note}</p>
                  </div>
                </div>
              ) : null}

              {curriculum ? (
                <div className="space-y-2">
                  <StepBadge n={3} label="4 həftəlik plan" />
                  <div className="rounded-xl border border-white/10 bg-[#121212]/80 p-3 space-y-3">
                    <p className="text-xs font-semibold text-white">{curriculum.title}</p>
                    {(curriculum.weeks || []).map((w) => (
                      <div key={w.week}>
                        <p className="text-[11px] font-bold text-primary">
                          Həftə {w.week}: {w.title}
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {(w.topics || []).map((topic) => (
                            <li key={topic} className="text-[11px] text-gray-400 pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-gray-600">
                              {topic}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {cta && tutorMatches[0] ? (
                <div className="space-y-2">
                  <StepBadge n={4} label="Növbəti addım" />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onInquiry?.(tutorMatches[0])}
                      className="text-xs font-bold px-3 py-2 rounded-xl bg-primary/20 border border-primary/40 text-primary"
                    >
                      {cta.trial_lesson?.label || 'Sınaq dərsi təyin et'}
                    </button>
                    <button
                      type="button"
                      disabled={whatsappBusy}
                      onClick={() => onWhatsApp?.(tutorMatches[0])}
                      className="text-xs font-bold px-3 py-2 rounded-xl border border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                    >
                      {cta.whatsapp?.label || 'WhatsApp ilə əlaqə'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
