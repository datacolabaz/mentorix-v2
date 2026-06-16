import { useCallback, useEffect, useState } from 'react'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import api from '../../lib/api'

const inp =
  'w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500 disabled:opacity-45 disabled:cursor-not-allowed'

/** Serverdəki `buildPlanFeaturesFromLimits` ilə eyni məntiqi önizləmə üçün */
function previewFeatures(p) {
  const student_limit = p.unlimited_students ? null : Math.max(0, Math.round(Number(p.student_count) || 0))
  const sms_limit = p.unlimited_sms ? null : Math.max(0, Math.round(Number(p.sms_count) || 0))
  let storage_gb = null
  let storage_limit_bytes = null
  if (!p.unlimited_storage) {
    const unit = String(p.storage_unit || 'GB')
      .trim()
      .toUpperCase()
    const val = Number(p.storage_value)
    if (Number.isFinite(val) && val >= 0) {
      if (unit === 'MB') {
        storage_limit_bytes = Math.round(val * 1024 * 1024)
      } else {
        storage_gb = val
      }
    }
  }
  const lines = []
  if (student_limit == null) lines.push('Limitsiz tələbə')
  else lines.push(`${student_limit} tələbə`)
  if (storage_gb == null && storage_limit_bytes == null) lines.push('Limitsiz yaddaş')
  else if (storage_limit_bytes != null) {
    const b = storage_limit_bytes
    if (b > 0 && b < 1024 * 1024) lines.push(`${Math.max(1, Math.round(b / 1024))} KB yaddaş`)
    else {
      const mb = b / (1024 * 1024)
      lines.push(`${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB yaddaş`)
    }
  } else lines.push(`${Number(storage_gb)} GB yaddaş`)
  if (sms_limit == null) lines.push('Limitsiz SMS / ay')
  else lines.push(`${sms_limit} SMS / ay`)
  if (p.unlimited_documents) lines.push('Limitsiz sənəd')
  else lines.push(`${Math.max(0, Math.round(Number(p.document_count) || 0))} sənəd`)
  if (p.unlimited_exams) lines.push('Limitsiz imtahan / ay')
  else lines.push(`${Math.max(0, Math.round(Number(p.exam_count) || 0))} imtahan / ay`)
  if (p.unlimited_homeworks) lines.push('Limitsiz tapşırıq / ay')
  else lines.push(`${Math.max(0, Math.round(Number(p.homework_count) || 0))} tapşırıq / ay`)
  return lines
}

function parseMarketingFeatures(raw) {
  if (Array.isArray(raw)) return raw.map((x) => String(x || '').trim()).filter(Boolean)
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return []
    try {
      const parsed = JSON.parse(s)
      if (Array.isArray(parsed)) return parsed.map((x) => String(x || '').trim()).filter(Boolean)
    } catch {
      return s.split('\n').map((x) => x.trim()).filter(Boolean)
    }
  }
  return []
}

function dbRowToEditor(p) {
  const slug = String(p.slug || 'basic').toLowerCase()
  const preset = PRESETS[slug] || PRESETS.basic
  const hasExamLimit = Object.prototype.hasOwnProperty.call(p, 'exam_limit')
  const hasHomeworkLimit = Object.prototype.hasOwnProperty.call(p, 'homework_limit')
  const hasDocumentLimit = Object.prototype.hasOwnProperty.call(p, 'document_limit')
  const unlimited_students = p.student_limit == null
  const unlimited_sms = p.sms_limit == null
  const unlimited_exams = hasExamLimit ? p.exam_limit == null : Boolean(preset.unlimited_exams)
  const unlimited_homeworks = hasHomeworkLimit ? p.homework_limit == null : Boolean(preset.unlimited_homeworks)
  const unlimited_documents = hasDocumentLimit ? p.document_limit == null : Boolean(preset.unlimited_documents)
  const unlimited_storage = p.storage_gb == null && p.storage_limit_bytes == null
  let storage_value = 1
  let storage_unit = 'GB'
  if (!unlimited_storage) {
    if (p.storage_limit_bytes != null && Number(p.storage_limit_bytes) > 0) {
      storage_unit = 'MB'
      storage_value = Number(p.storage_limit_bytes) / (1024 * 1024)
    } else if (p.storage_gb != null) {
      storage_unit = 'GB'
      storage_value = Number(p.storage_gb)
    }
  }
  return {
    slug: p.slug,
    title: p.title ?? '',
    price_azn: Number(p.price_azn) || 0,
    is_active: p.is_active !== false,
    highlight: Boolean(p.highlight),
    ram_limit_mb: p.ram_limit_mb ?? '',
    unlimited_students,
    student_count: unlimited_students ? '' : String(p.student_limit ?? ''),
    unlimited_sms,
    sms_count: unlimited_sms ? '' : String(p.sms_limit ?? ''),
    unlimited_exams,
    exam_count: unlimited_exams
      ? ''
      : String(hasExamLimit ? (p.exam_limit ?? '') : (preset.exam_count ?? '')),
    unlimited_homeworks,
    homework_count: unlimited_homeworks
      ? ''
      : String(hasHomeworkLimit ? (p.homework_limit ?? '') : (preset.homework_count ?? '')),
    unlimited_documents,
    document_count: unlimited_documents
      ? ''
      : String(hasDocumentLimit ? (p.document_limit ?? '') : (preset.document_count ?? '')),
    unlimited_storage,
    storage_value: unlimited_storage ? '' : String(storage_value),
    storage_unit,
    marketing_features: (() => {
      const fromDb = parseMarketingFeatures(p.marketing_features)
      if (fromDb.length) return fromDb
      return [...(preset.marketing_features || [])]
    })(),
    plan_subtitle: p.plan_subtitle ?? preset.plan_subtitle ?? '',
    plan_cta: p.plan_cta ?? preset.plan_cta ?? '',
    popular_label: p.popular_label ?? preset.popular_label ?? '',
  }
}

function editorToPayload(p) {
  return {
    slug: p.slug,
    title: p.title,
    price_azn: Number(p.price_azn) || 0,
    is_active: p.is_active,
    highlight: p.highlight,
    ram_limit_mb: p.ram_limit_mb === '' || p.ram_limit_mb == null ? null : Number(p.ram_limit_mb),
    unlimited_students: Boolean(p.unlimited_students),
    student_count: p.unlimited_students ? null : Number(p.student_count),
    unlimited_sms: Boolean(p.unlimited_sms),
    sms_count: p.unlimited_sms ? null : Number(p.sms_count),
    unlimited_exams: Boolean(p.unlimited_exams),
    exam_count: p.unlimited_exams ? null : Number(p.exam_count),
    unlimited_homeworks: Boolean(p.unlimited_homeworks),
    homework_count: p.unlimited_homeworks ? null : Number(p.homework_count),
    unlimited_documents: Boolean(p.unlimited_documents),
    document_count: p.unlimited_documents ? null : Number(p.document_count),
    unlimited_storage: Boolean(p.unlimited_storage),
    storage_value: p.unlimited_storage ? null : Number(p.storage_value),
    storage_unit: p.unlimited_storage ? null : p.storage_unit,
    marketing_features: (p.marketing_features || []).map((x) => String(x || '').trim()).filter(Boolean),
    plan_subtitle: String(p.plan_subtitle || '').trim(),
    plan_cta: String(p.plan_cta || '').trim(),
    popular_label: String(p.popular_label || '').trim(),
  }
}

const PRESETS = {
  basic: {
    title: 'SADƏ',
    price_azn: 0,
    unlimited_students: false,
    student_count: '5',
    unlimited_documents: false,
    document_count: '50',
    unlimited_storage: false,
    storage_value: '5',
    storage_unit: 'MB',
    unlimited_sms: false,
    sms_count: '5',
    unlimited_exams: false,
    exam_count: '2',
    unlimited_homeworks: false,
    homework_count: '5',
    highlight: false,
    ram_limit_mb: '',
    marketing_features: ['Ödəniş izləmə', 'Valideyn bildirişləri', 'Xəritədə görünmə'],
    plan_subtitle: '14 günlük pulsuz sınaq',
    plan_cta: '14 günlük sınağa başla',
    popular_label: '',
  },
  pro: {
    title: 'STANDART',
    price_azn: 5,
    unlimited_students: false,
    student_count: '20',
    unlimited_documents: false,
    document_count: '1250',
    unlimited_storage: false,
    storage_value: '128',
    storage_unit: 'MB',
    unlimited_sms: false,
    sms_count: '20',
    unlimited_exams: false,
    exam_count: '20',
    unlimited_homeworks: false,
    homework_count: '40',
    highlight: true,
    ram_limit_mb: '',
    marketing_features: ['Ödəniş izləmə', 'Valideyn bildirişləri', 'Xəritədə görünmə'],
    plan_subtitle: '',
    plan_cta: 'Standart seç',
    popular_label: '⭐ Ən populyar',
  },
  growth: {
    title: 'PROFESSİONAL',
    price_azn: 10,
    unlimited_students: false,
    student_count: '50',
    unlimited_documents: false,
    document_count: '5000',
    unlimited_storage: false,
    storage_value: '512',
    storage_unit: 'MB',
    unlimited_sms: false,
    sms_count: '50',
    unlimited_exams: false,
    exam_count: '50',
    unlimited_homeworks: false,
    homework_count: '120',
    highlight: false,
    ram_limit_mb: '',
    marketing_features: ['Ödəniş izləmə', 'Valideyn bildirişləri', 'Xəritədə görünmə', 'Ətraflı hesabatlar'],
    plan_subtitle: '',
    plan_cta: 'Professional seç',
    popular_label: '',
  },
  premium: {
    title: 'PREMİUM',
    price_azn: 19,
    unlimited_students: true,
    student_count: '',
    unlimited_documents: true,
    document_count: '',
    unlimited_storage: true,
    storage_value: '',
    storage_unit: 'MB',
    unlimited_sms: false,
    sms_count: '200',
    unlimited_exams: true,
    exam_count: '',
    unlimited_homeworks: true,
    homework_count: '',
    highlight: false,
    ram_limit_mb: '',
    marketing_features: [
      'Ödəniş izləmə',
      'Valideyn bildirişləri',
      'Xəritədə görünmə',
      'Ətraflı hesabatlar',
      'Prioritet texniki dəstək',
    ],
    plan_subtitle: '',
    plan_cta: 'Premium seç',
    popular_label: '',
  },
}

function Toggle({ label, checked, onChange, id }) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-3 rounded-xl border border-indigo-500/20 bg-[#13112e]/80 px-3 py-2">
      <span className="text-xs font-semibold text-gray-300">{label}</span>
      <input id={id} type="checkbox" className="accent-indigo-500 h-4 w-4 shrink-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

export default function AdminSettings() {
  const [plans, setPlans] = useState([])
  const [plansBusy, setPlansBusy] = useState(false)
  const [plansReloadBusy, setPlansReloadBusy] = useState(false)
  const [plansErr, setPlansErr] = useState(null)
  const [plansLoadedAt, setPlansLoadedAt] = useState(null)
  const toast = useToast()

  const fetchPlans = useCallback(async () => {
    setPlansErr(null)
    const d = await api.get(`/admin/plans?t=${Date.now()}`)
    const list = Array.isArray(d?.plans) ? d.plans : []
    setPlans(list.map(dbRowToEditor))
    setPlansLoadedAt(new Date().toISOString())
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await fetchPlans()
      } catch (e) {
        if (!cancelled) setPlansErr(e?.message || 'Planlar yüklənmədi')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fetchPlans])

  const validatePlan = (p) => {
    if (!String(p.title || '').trim()) return 'Görünən ad boş ola bilməz'
    if (!p.unlimited_students) {
      const n = Number(p.student_count)
      if (!Number.isFinite(n) || n < 0) return 'Tələbə sayı düzgün deyil'
    }
    if (!p.unlimited_sms) {
      const n = Number(p.sms_count)
      if (!Number.isFinite(n) || n < 0) return 'SMS sayı düzgün deyil'
    }
    if (!p.unlimited_exams) {
      const n = Number(p.exam_count)
      if (!Number.isFinite(n) || n < 0) return 'İmtahan sayı düzgün deyil'
    }
    if (!p.unlimited_homeworks) {
      const n = Number(p.homework_count)
      if (!Number.isFinite(n) || n < 0) return 'Tapşırıq sayı düzgün deyil'
    }
    if (!p.unlimited_documents) {
      const n = Number(p.document_count)
      if (!Number.isFinite(n) || n < 0) return 'Sənəd sayı düzgün deyil'
    }
    if (!p.unlimited_storage) {
      const n = Number(p.storage_value)
      if (!Number.isFinite(n) || n < 0) return 'Yaddaş həcmi düzgün deyil'
      if (!['MB', 'GB'].includes(String(p.storage_unit || '').toUpperCase())) return 'Yaddaş vahidi MB və ya GB olmalıdır'
    }
    return null
  }

  const patch = useCallback((idx, partial) => {
    setPlans((arr) => arr.map((x, i) => (i === idx ? { ...x, ...partial } : x)))
  }, [])

  const applyPreset = useCallback((idx, key) => {
    const pr = PRESETS[key]
    if (!pr) return
    patch(idx, { ...pr })
    toast(`Şablon: ${PRESETS[key]?.title || key}`)
  }, [patch, toast])

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-4xl mx-auto w-full">
      <h1 className="font-display font-bold text-xl sm:text-2xl mb-4 sm:mb-6 break-words">Tənzimləmələr</h1>

      <Card className="p-4 sm:p-6">
        <h2 className="font-display font-bold text-base mb-1">Paketlər</h2>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Limitlər üçün <strong className="text-gray-300">Limitsiz</strong> keçidlərini açın. Yaddaş üçün rəqəm +{' '}
          <strong className="text-gray-300">MB</strong> və ya <strong className="text-gray-300">GB</strong> — server avtomatik saxlayır.
          Aylıq <strong className="text-gray-300">imtahan</strong> və <strong className="text-gray-300">tapşırıq</strong> limitlərini də buradan tənzimləyin; xüsusiyyətlər limitlərdən avtomatik yaradılır.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          {plansLoadedAt ? (
            <p className="text-[11px] text-gray-500">
              Son yükləmə:{' '}
              <span className="text-gray-300 tabular-nums">{new Date(plansLoadedAt).toLocaleString('az-AZ')}</span>
            </p>
          ) : (
            <span />
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={plansReloadBusy}
            className="shrink-0"
            onClick={async () => {
              setPlansReloadBusy(true)
              try {
                await fetchPlans()
                toast('Yeniləndi')
              } catch (e) {
                setPlansErr(e?.message || 'Yenilənmədi')
              } finally {
                setPlansReloadBusy(false)
              }
            }}
          >
            Serverdən yenilə
          </Button>
        </div>

        {plansErr ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-100 px-4 py-3 text-sm mb-4">{plansErr}</div>
        ) : null}

        {!plans.length ? (
          <div className="text-sm text-gray-400">Plan tapılmadı.</div>
        ) : (
          <div className="space-y-6">
            {plans.map((p, idx) => {
              const prevLines = previewFeatures(p)
              return (
                <div key={p.slug} className="rounded-2xl border border-indigo-500/20 bg-[#0f0c29]/70 p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-mono uppercase tracking-wider text-indigo-300">{p.slug}</div>
                    <label className="text-xs text-gray-300 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(p.is_active)}
                        onChange={(e) => patch(idx, { is_active: e.target.checked })}
                      />
                      Aktiv
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Görünən ad (müəllim paneli + landing)
                      </label>
                      <input className={inp} value={p.title} onChange={(e) => patch(idx, { title: e.target.value })} />
                      <p className="text-[10px] text-gray-500 mt-1.5">
                        Texniki kod: <span className="font-mono text-gray-400">{p.slug}</span> — kartlarda yuxarıdakı ad göstərilir.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Qiymət (AZN / ay)</label>
                      <input
                        type="number"
                        step="any"
                        className={inp}
                        value={p.price_azn}
                        onChange={(e) => patch(idx, { price_azn: e.target.value === '' ? 0 : Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">RAM (MB, istəyə bağlı)</label>
                      <input
                        type="number"
                        className={inp}
                        value={p.ram_limit_mb}
                        placeholder="boş"
                        onChange={(e) => patch(idx, { ram_limit_mb: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => applyPreset(idx, 'basic')}>
                      Şablon: SADƏ
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => applyPreset(idx, 'pro')}>
                      Şablon: STANDART
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => applyPreset(idx, 'growth')}>
                      Şablon: PROFESSİONAL
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => applyPreset(idx, 'premium')}>
                      Şablon: PREMİUM
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Toggle
                        id={`us-${p.slug}`}
                        label="Limitsiz tələbə"
                        checked={p.unlimited_students}
                        onChange={(v) => patch(idx, { unlimited_students: v })}
                      />
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tələbə limiti</label>
                        <input
                          type="number"
                          min={0}
                          className={inp}
                          disabled={p.unlimited_students}
                          value={p.student_count}
                          onChange={(e) => patch(idx, { student_count: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Toggle
                        id={`usms-${p.slug}`}
                        label="Limitsiz SMS (aylıq)"
                        checked={p.unlimited_sms}
                        onChange={(v) => patch(idx, { unlimited_sms: v })}
                      />
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">SMS / ay</label>
                        <input
                          type="number"
                          min={0}
                          className={inp}
                          disabled={p.unlimited_sms}
                          value={p.sms_count}
                          onChange={(e) => patch(idx, { sms_count: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Toggle
                        id={`udoc-${p.slug}`}
                        label="Limitsiz sənəd"
                        checked={p.unlimited_documents}
                        onChange={(v) => patch(idx, { unlimited_documents: v })}
                      />
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sənəd limiti</label>
                        <input
                          type="number"
                          min={0}
                          className={inp}
                          disabled={p.unlimited_documents}
                          value={p.document_count}
                          onChange={(e) => patch(idx, { document_count: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2 rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-3 space-y-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">
                        Aylıq məzmun limitləri
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Toggle
                            id={`uex-${p.slug}`}
                            label="Limitsiz imtahan (aylıq)"
                            checked={p.unlimited_exams}
                            onChange={(v) => patch(idx, { unlimited_exams: v })}
                          />
                          <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">İmtahan / ay</label>
                            <input
                              type="number"
                              min={0}
                              className={inp}
                              disabled={p.unlimited_exams}
                              value={p.exam_count}
                              onChange={(e) => patch(idx, { exam_count: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Toggle
                            id={`uhw-${p.slug}`}
                            label="Limitsiz tapşırıq (aylıq)"
                            checked={p.unlimited_homeworks}
                            onChange={(v) => patch(idx, { unlimited_homeworks: v })}
                          />
                          <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tapşırıq / ay</label>
                            <input
                              type="number"
                              min={0}
                              className={inp}
                              disabled={p.unlimited_homeworks}
                              value={p.homework_count}
                              onChange={(e) => patch(idx, { homework_count: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="sm:col-span-2 space-y-2">
                      <Toggle
                        id={`ust-${p.slug}`}
                        label="Limitsiz yaddaş"
                        checked={p.unlimited_storage}
                        onChange={(v) => patch(idx, { unlimited_storage: v })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Həcm</label>
                          <input
                            type="number"
                            step="any"
                            min={0}
                            className={inp}
                            disabled={p.unlimited_storage}
                            value={p.storage_value}
                            onChange={(e) => patch(idx, { storage_value: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Vahid</label>
                          <select
                            className={inp}
                            disabled={p.unlimited_storage}
                            value={p.storage_unit}
                            onChange={(e) => patch(idx, { storage_unit: e.target.value })}
                          >
                            <option value="MB">MB</option>
                            <option value="GB">GB</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="sm:col-span-2 rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">
                        Kart imkanları (landing)
                      </div>
                      <p className="text-[10px] text-gray-500 leading-relaxed">
                        Limit sətirləri avtomatik yaradılır. Buradan platforma imkanlarını, alt başlığı, populyar etiketi və düymə mətnini idarə edin.
                      </p>
                      {(p.marketing_features || []).map((line, lineIdx) => (
                        <div key={`${p.slug}-mkt-${lineIdx}`} className="flex gap-2">
                          <input
                            className={inp}
                            value={line}
                            placeholder="Məs: Ödəniş izləmə"
                            onChange={(e) => {
                              const next = [...(p.marketing_features || [])]
                              next[lineIdx] = e.target.value
                              patch(idx, { marketing_features: next })
                            }}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="shrink-0"
                            onClick={() => {
                              const next = [...(p.marketing_features || [])]
                              next.splice(lineIdx, 1)
                              patch(idx, { marketing_features: next })
                            }}
                          >
                            Sil
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => patch(idx, { marketing_features: [...(p.marketing_features || []), ''] })}
                      >
                        + Sətir əlavə et
                      </Button>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Alt başlıq</label>
                          <input
                            className={inp}
                            value={p.plan_subtitle}
                            onChange={(e) => patch(idx, { plan_subtitle: e.target.value })}
                            placeholder="Məs: 14 günlük pulsuz sınaq"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Populyar etiket</label>
                          <input
                            className={inp}
                            value={p.popular_label}
                            onChange={(e) => patch(idx, { popular_label: e.target.value })}
                            placeholder="Məs: ⭐ Ən populyar"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Kart düyməsi (CTA)</label>
                          <input
                            className={inp}
                            value={p.plan_cta}
                            onChange={(e) => patch(idx, { plan_cta: e.target.value })}
                            placeholder="Məs: Standart seç"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                        <input type="checkbox" className="accent-indigo-500" checked={p.highlight} onChange={(e) => patch(idx, { highlight: e.target.checked })} />
                        Vurğula (kartda xüsusi çərçivə)
                      </label>
                    </div>

                    <div className="sm:col-span-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Avtomatik limit sətirləri</div>
                      <ul className="text-xs text-gray-300 space-y-0.5 list-disc list-inside mb-3">
                        {prevLines.map((line, li) => (
                          <li key={`${p.slug}-${li}`}>{line}</li>
                        ))}
                      </ul>
                      {(p.marketing_features || []).filter((x) => String(x || '').trim()).length > 0 ? (
                        <>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Kart imkanları (önizləmə)</div>
                          <ul className="text-xs text-gray-300 space-y-0.5 list-disc list-inside">
                            {(p.marketing_features || [])
                              .map((x) => String(x || '').trim())
                              .filter(Boolean)
                              .map((line, li) => (
                                <li key={`${p.slug}-mkt-prev-${li}`}>{line}</li>
                              ))}
                          </ul>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}

            <Button
              loading={plansBusy}
              className="w-full justify-center"
              onClick={async () => {
                for (const p of plans) {
                  const err = validatePlan(p)
                  if (err) {
                    toast(`${p.slug}: ${err}`, 'error')
                    return
                  }
                }
                setPlansErr(null)
                setPlansBusy(true)
                try {
                  const payload = plans.map(editorToPayload)
                  const d = await api.put('/admin/plans', { plans: payload })
                  const list = Array.isArray(d?.plans) ? d.plans : []
                  setPlans(list.map(dbRowToEditor))
                  setPlansLoadedAt(new Date().toISOString())
                  toast('Planlar saxlanıldı')
                } catch (e) {
                  setPlansErr(e?.message || 'Saxlanmadı')
                } finally {
                  setPlansBusy(false)
                }
              }}
            >
              Hamısını saxla
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
