import { useState } from 'react'
import api from '../../lib/api'
import { localDatetimeInputToUtcIso } from '../../lib/examDatetime'
import Button from '../common/Button'
import { useToast } from '../common/Toast'
 
const TYPES = {
  closed: 'Qapali (ABCDE)',
  matching: 'Uygunluq',
  multiple: 'Coxsecimli',
  sequence: 'Ardıcıllıq (Ordering)',
  open: 'Aciq',
}

/** Uyğunluq: sol sətirdəki rəqəm + sağdakı hərflər → bitişik açar (server ilə eyni məntiq) */
export function deriveMatchingKey(options) {
  if (!Array.isArray(options)) return ''
  let key = ''
  for (let i = 0; i < options.length; i++) {
    const row = options[i]
    if (!row || typeof row !== 'object') continue
    const L = String(row.left ?? '').trim()
    const R = String(row.right ?? '').trim()
    const num = (L.match(/\d+/) || [])[0] || String(i + 1)
    const letters = R.replace(/[^a-z]/gi, '').toLowerCase()
    for (const ch of letters) {
      if (/[a-z]/.test(ch)) key += num + ch
    }
  }
  return key
}
 
export default function ExamForm({ students, studentsLoading = false, onCreated }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const toast = useToast()

  const [meta, setMeta] = useState({
    title: '',
    subject: '',
    topic: '',
    duration_minutes: 60,
    available_from: '',
    available_until: '',
    allow_finish_after_until: true,
    notify_students: false,
    show_results: true,
    /** Qapalı + çoxseçimli üçün -0.25 cərimə (imtahan səviyyəsi) */
    wrong_penalty_enabled: true,
    student_ids: [],
  })

  /** { id, name, url }[] — bir neçə PDF/şəkil */
  const [materialFiles, setMaterialFiles] = useState([])
 
  const [questions, setQuestions] = useState([])
 
  const addQuestion = (type) => setQuestions(prev => [...prev, {
    id: Date.now(),
    question_type: type,
    points: 10,
    order_num: prev.length + 1,
    correct_answer: '',
    options: type === 'closed' ? ['', '', '', '', ''] :
              type === 'multiple' ? ['', '', '', ''] :
              type === 'sequence' ? ['', '', ''] :
              type === 'matching' ? [{ left: '', right: '' }, { left: '', right: '' }] : [],
    template_hint: type === 'open' ? '3.5' : type === 'matching' ? '' : type === 'multiple' ? '23' : type === 'sequence' ? '231' : '',
  }])
 
  const upd = (idx, field, value) =>
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q))
 
  const updOpt = (qIdx, optIdx, value) =>
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q
      const opts = [...q.options]; opts[optIdx] = value
      return { ...q, options: opts }
    }))
 
  const updMatch = (qIdx, optIdx, side, value) =>
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q
      const opts = [...q.options]; opts[optIdx] = { ...opts[optIdx], [side]: value }
      return { ...q, options: opts }
    }))

  /** Çoxseçimli: tək rəqəm (1–9) düzgün cavaba əlavə/sil, bitişik saxlanır */
  const toggleMultipleDigit = (qIdx, digit) => {
    if (!/^[1-9]$/.test(digit)) return
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx || q.question_type !== 'multiple') return q
        const set = new Set(String(q.correct_answer || '').replace(/\D/g, '').split(''))
        if (set.has(digit)) set.delete(digit)
        else set.add(digit)
        const next = [...set].sort().join('')
        return { ...q, correct_answer: next }
      })
    )
  }
 
  const removeMaterial = (id) => {
    setMaterialFiles((prev) => prev.filter((x) => x.id !== id))
  }

  const handleMaterialsChange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setPdfBusy(true)
    try {
      const results = await Promise.all(
        files.map(async (f) => {
          const fd = new FormData()
          fd.append('file', f)
          const data = await api.post('/exams/upload', fd)
          return {
            id: `${data.url}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: data.filename || f.name,
            url: data.url,
          }
        })
      )
      setMaterialFiles((prev) => [...prev, ...results])
      toast(`${results.length} fayl serverə yükləndi`)
    } catch (err) {
      toast(err.message || 'Fayl yüklənmədi (yalnız PDF, JPG, PNG)', 'error')
    } finally {
      setPdfBusy(false)
      e.target.value = ''
    }
  }

  const submit = async () => {
    if (!meta.title || !meta.available_from || !meta.available_until) {
      toast('Ad və aktivlik vaxtları tələb olunur', 'error')
      return
    }
    setLoading(true)
    try {
      const exam_files = materialFiles.map(({ name, url }) => ({ name, url }))
      await api.post('/exams', {
        title: meta.title,
        subject: meta.subject,
        topic: meta.topic,
        duration_minutes: meta.duration_minutes,
        student_ids: meta.student_ids,
        notify_students: meta.notify_students,
        show_results: meta.show_results,
        wrong_penalty_enabled: meta.wrong_penalty_enabled !== false,
        allow_finish_after_until: meta.allow_finish_after_until,
        pdf_url: exam_files[0]?.url || null,
        exam_files,
        // Backward-compat: keep start_time aligned with available_from
        start_time: localDatetimeInputToUtcIso(meta.available_from),
        available_from: localDatetimeInputToUtcIso(meta.available_from),
        available_until: localDatetimeInputToUtcIso(meta.available_until),
        questions: questions.map((q, i) => ({
          question_text: `Sual ${i + 1}`,
          question_type: q.question_type,
          points: q.points,
          order_num: q.order_num,
          negative_marking:
            q.question_type === 'closed' || q.question_type === 'multiple'
              ? meta.wrong_penalty_enabled !== false
                ? -0.25
                : 0
              : 0,
          options: q.question_type === 'closed'
            ? q.options.map((o, j) => ({
                key: String.fromCharCode(65 + j),
                text: typeof o === 'string' ? o : (o?.text ?? ''),
              }))
            : q.question_type === 'multiple'
              ? q.options.map((o, j) => ({
                  key: String(j + 1),
                  text: typeof o === 'string' ? o : (o?.text ?? ''),
                }))
              : q.options,
          correct_answer:
            q.question_type === 'multiple'
              ? String(q.correct_answer || '')
                  .replace(/\D/g, '')
                  .split('')
                  .filter((c, idx, arr) => arr.indexOf(c) === idx)
                  .sort()
                  .join('')
              : q.question_type === 'matching'
                ? deriveMatchingKey(q.options) || String(q.correct_answer || '').trim()
                : q.question_type === 'sequence'
                  ? String(q.correct_answer || '').replace(/\D/g, '').slice(0, 120)
                : q.correct_answer,
          template_hint: q.template_hint,
        })),
      })
      toast('Imtahan yaradildi!')
      onCreated?.()
    } catch (err) { toast(err.message || 'Xeta', 'error') }
    finally { setLoading(false) }
  }
 
  const inp =
    'w-full rounded-xl px-4 py-2.5 text-sm outline-none border border-[color:var(--border-subtle)] bg-token-surfaceCard/55 text-token-textMain placeholder:text-token-textMuted focus:border-primary/40'
  const inpSmFlex =
    'flex-1 rounded-lg px-3 py-1.5 text-xs outline-none border border-[color:var(--border-subtle)] bg-token-surfaceCard/55 text-token-textMain placeholder:text-token-textMuted focus:border-primary/40'
  const inpSmFull =
    'w-full rounded-lg px-3 py-1.5 text-xs outline-none border border-[color:var(--border-subtle)] bg-token-surfaceCard/55 text-token-textMain placeholder:text-token-textMuted focus:border-primary/40'
  const inpSmFullMono = `${inpSmFull} font-mono`
 
  return (
    <div>
      {/* Addimlar */}
      <div className="flex mb-6">
        {['Umumi', 'Suallar', 'Telebeler'].map((s, i) => (
          <button key={i} onClick={() => setStep(i + 1)}
            className={'flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors ' +
              (step === i + 1 ? 'border-blue-500 text-blue-400' : 'border-[color:var(--border-subtle)] text-token-textMuted')}>
            {i + 1}. {s}
          </button>
        ))}
      </div>
 
      {/* STEP 1 */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Imtahan Adi *</label>
            <input className={inp} placeholder="Riyaziyyat Yarimil Imtahani"
              value={meta.title} onChange={e => setMeta(p => ({ ...p, title: e.target.value }))} />
          </div>
 
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fenn</label>
              <input className={inp} placeholder="Riyaziyyat"
                value={meta.subject} onChange={e => setMeta(p => ({ ...p, subject: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Movzu</label>
              <input className={inp} placeholder="Inteqral"
                value={meta.topic} onChange={e => setMeta(p => ({ ...p, topic: e.target.value }))} />
            </div>
          </div>
 
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Aktivlik baslangici *</label>
              <input
                type="datetime-local"
                className={inp}
                value={meta.available_from}
                onChange={e => setMeta(p => ({ ...p, available_from: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Son giris vaxti *</label>
              <input
                type="datetime-local"
                className={inp}
                value={meta.available_until}
                onChange={e => setMeta(p => ({ ...p, available_until: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="allow_finish_after_until"
              type="checkbox"
              className="h-4 w-4 rounded border-[color:var(--border-subtle)] bg-token-surfaceCard/40"
              checked={meta.allow_finish_after_until !== false}
              onChange={(e) => setMeta((p) => ({ ...p, allow_finish_after_until: e.target.checked }))}
            />
            <label htmlFor="allow_finish_after_until" className="text-sm text-gray-300">
              Son giriş vaxtı bitəndə yeni giriş bağlansın, amma daxil olan tələbə müddətini tamamlaya bilsin
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Muddet (deq)</label>
              <input
                type="number"
                min={1}
                className={inp}
                value={Number.isFinite(Number(meta.duration_minutes)) ? meta.duration_minutes : ''}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  setMeta((p) => ({
                    ...p,
                    duration_minutes: Number.isFinite(v) ? v : p.duration_minutes,
                  }))
                }}
              />
            </div>
            <div />
          </div>
 
          <div className="space-y-3 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 p-4">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
              PDF / şəkil — bir və ya bir neçə fayl (Ctrl/Cmd ilə seç)
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={pdfBusy}
              className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-500/20 file:text-blue-400 hover:file:bg-blue-500/30 cursor-pointer disabled:opacity-50"
              onChange={handleMaterialsChange}
            />
            {pdfBusy && <p className="text-xs text-amber-400">Yüklənir…</p>}
            {materialFiles.length > 0 && (
              <ul className="space-y-2 mt-2">
                {materialFiles.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between gap-2 text-xs rounded-lg border border-[color:var(--border-subtle)] bg-token-surfaceCard/50 px-3 py-2"
                  >
                    <span className="text-emerald-400 truncate" title={f.name}>
                      ✓ {f.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMaterial(f.id)}
                      className="text-red-400 hover:text-red-300 shrink-0 px-2"
                    >
                      Sil
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
 
          <div className="space-y-3 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">SMS bildirisi</p>
                <p className="text-xs text-gray-500">
                  Başlamadan 5 dəq əvvəl SMS (əvvəl tələbə nömrəsi, yoxdursa valideyn). İmtahan bitəndə nəticə valideynə SMS.
                </p>
              </div>
              <input type="checkbox" checked={meta.notify_students}
                onChange={e => setMeta(p => ({ ...p, notify_students: e.target.checked }))}
                className="w-4 h-4 accent-blue-500" />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Neticeni telebeye goster</p>
              <input type="checkbox" checked={meta.show_results}
                onChange={e => setMeta(p => ({ ...p, show_results: e.target.checked }))}
                className="w-4 h-4 accent-blue-500" />
            </div>
            <div className="flex items-start justify-between gap-3 border-t border-[color:var(--border-subtle)] pt-2">
              <div>
                <p className="text-sm font-semibold">Səhv düzü aparsın (0.25 cərimə)</p>
                <p className="text-xs text-gray-500 mt-1">
                  Qapalı və çoxseçimli suallarda səhvə görə bal çıxılır. Söndürsəniz, imtahan cəriməsiz olacaq.
                </p>
              </div>
              <input
                type="checkbox"
                checked={meta.wrong_penalty_enabled !== false}
                onChange={(e) => setMeta((p) => ({ ...p, wrong_penalty_enabled: e.target.checked }))}
                className="w-4 h-4 accent-blue-500 shrink-0 mt-1"
              />
            </div>
          </div>
 
          <Button onClick={() => setStep(2)} className="w-full justify-center">Novbeti → Suallar</Button>
        </div>
      )}
 
      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 p-3 text-xs text-token-textMuted">
            PDF-deki her sual ucun tipini secin ve duzgun cavabi teyin edin.
          </p>
 
          <div className="flex gap-2 flex-wrap">
            {Object.entries(TYPES).map(([type, label]) => (
              <button key={type} onClick={() => addQuestion(type)}
                className="px-3 py-2 text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl hover:bg-indigo-500/30 transition-colors">
                + {label}
              </button>
            ))}
          </div>
 
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {questions.length === 0 && (
              <div className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 py-10 text-center text-sm text-token-textMuted">
                Yuxaridan sual tipi secin
              </div>
            )}
            {questions.map((q, idx) => (
              <div key={q.id} className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 p-4">
                {/* Sual basligi */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-300">{idx + 1}. {TYPES[q.question_type]}</span>
                    {(q.question_type === 'closed' || q.question_type === 'multiple') &&
                      meta.wrong_penalty_enabled !== false && (
                      <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-lg">
                        0.25 cərimə
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0.01"
                      max="1000"
                      step="any"
                      value={
                        q.points === '' || q.points == null || !Number.isFinite(Number(q.points))
                          ? ''
                          : q.points
                      }
                      onChange={(e) => {
                        const raw = e.target.value
                        if (raw === '') {
                          upd(idx, 'points', '')
                          return
                        }
                        const v = parseFloat(raw)
                        upd(idx, 'points', Number.isFinite(v) ? v : q.points)
                      }}
                      className="min-w-[4.5rem] w-20 rounded-lg border border-[color:var(--border-subtle)] bg-token-surfaceCard/55 px-2 py-1 text-center text-xs text-token-textMain outline-none focus:border-primary/40" />
                    <span className="text-xs text-gray-500">bal</span>
                    <button onClick={() => setQuestions(prev => prev.filter((_, i) => i !== idx))}
                      className="text-red-400 text-sm ml-1">✕</button>
                  </div>
                </div>
 
                {/* QAPALI */}
                {q.question_type === 'closed' && (
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => {
                      const key = String.fromCharCode(65 + oi)
                      return (
                        <div key={oi} className="flex items-center gap-2">
                          <span onClick={() => upd(idx, 'correct_answer', key)}
                            className={'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer flex-shrink-0 ' +
                              (q.correct_answer === key ? 'bg-emerald-500 text-white' : 'border border-[color:var(--border-subtle)] bg-token-surfaceCard/50 text-token-textMuted')}>
                            {key}
                          </span>
                          <input className={inpSmFlex}
                            placeholder={key + ' varianti'} value={opt}
                            onChange={e => updOpt(idx, oi, e.target.value)} />
                        </div>
                      )
                    })}
                    <p className="text-xs text-gray-500">Duzgun cavabi secmek ucun herfin uzerine basin.</p>
                  </div>
                )}
 
                {/* COXSECIMLI — ifadələr 1,2,3…; düzgün cavab bitişik rəqəmlər (məs. 23) */}
                {q.question_type === 'multiple' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">
                      Hər sətirdə ifadə yazın. Düzgün olanların nömrəsinə toxunun və ya aşağıda bitişik rəqəm yazın (işarə yoxdur).
                    </p>
                    {q.options.map((opt, oi) => {
                      const num = String(oi + 1)
                      const picked = new Set(String(q.correct_answer || '').replace(/\D/g, '').split('')).has(num)
                      const canToggle = oi < 9
                      return (
                        <div key={oi} className="flex items-center gap-2">
                          {canToggle ? (
                            <button
                              type="button"
                              onClick={() => toggleMultipleDigit(idx, num)}
                              className={
                                'w-8 h-8 rounded-lg text-xs font-bold shrink-0 border transition-colors ' +
                                (picked
                                  ? 'bg-emerald-500/30 border-emerald-500 text-emerald-200'
                                  : 'border border-[color:var(--border-subtle)] bg-token-surfaceCard/50 text-token-textMuted hover:border-primary/30')
                              }
                            >
                              {num}
                            </button>
                          ) : (
                            <span className="w-8 text-center text-xs text-gray-500 shrink-0">{num}</span>
                          )}
                          <input
                            className={inpSmFlex}
                            placeholder={`${num} — ifadə mətni`}
                            value={typeof opt === 'string' ? opt : (opt?.text ?? '')}
                            onChange={(e) => updOpt(idx, oi, e.target.value)}
                          />
                        </div>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => upd(idx, 'options', [...q.options, ''])}
                      className="text-xs text-indigo-400"
                    >
                      + İfadə əlavə et
                    </button>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Düzgün cavab (bitişik rəqəmlər)</label>
                      <input
                        className={inpSmFullMono}
                        placeholder="23"
                        value={q.correct_answer || ''}
                        onChange={(e) => {
                          const next = e.target.value
                            .replace(/\D/g, '')
                            .split('')
                            .filter((c, i, a) => a.indexOf(c) === i)
                            .sort()
                            .join('')
                          upd(idx, 'correct_answer', next)
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tələbəyə nümunə (placeholder)</label>
                      <input
                        className={inpSmFullMono}
                        placeholder="23"
                        value={q.template_hint || ''}
                        onChange={(e) => upd(idx, 'template_hint', e.target.value)}
                      />
                    </div>
                  </div>
                )}
 
                {/* UYGUNLUQ */}
                {q.question_type === 'matching' && (
                  <div className="space-y-2">
                    {q.options.map((pair, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-4">{oi + 1}</span>
                        <input className={inpSmFlex}
                          placeholder="Sol" value={pair.left || ''}
                          onChange={e => updMatch(idx, oi, 'left', e.target.value)} />
                        <span className="text-gray-500 text-xs">→</span>
                        <input className={inpSmFlex}
                          placeholder="Sag" value={pair.right || ''}
                          onChange={e => updMatch(idx, oi, 'right', e.target.value)} />
                        <button onClick={() => upd(idx, 'options', q.options.filter((_, i) => i !== oi))}
                          className="text-red-400 text-xs">✕</button>
                      </div>
                    ))}
                    <button onClick={() => upd(idx, 'options', [...q.options, { left: '', right: '' }])}
                      className="text-xs text-indigo-400">+ Cut elave et</button>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Düzgün uyğunluq açarı (rəqəm+hərf, məs. 1a2b və ya 1ab2cd)</label>
                      <input
                        className={inpSmFullMono}
                        placeholder={deriveMatchingKey(q.options) || '1a2b3c'}
                        value={q.correct_answer || ''}
                        onChange={(e) =>
                          upd(idx, 'correct_answer', e.target.value.toLowerCase().replace(/[^0-9a-z]/g, ''))
                        }
                      />
                      <p className="text-[11px] text-gray-500 mt-1">
                        Boş saxlasanız, soldakı nömrə və sağdakı hərflərdən avtomatik yığılır. Şablon yalnız tələbəyə nümunə üçündür, düzgün cavab deyil.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tələbəyə nümunə format (placeholder)</label>
                      <input
                        className={inpSmFullMono}
                        placeholder="məs. 1a2b"
                        value={q.template_hint || ''}
                        onChange={(e) => upd(idx, 'template_hint', e.target.value)}
                      />
                    </div>
                  </div>
                )}
 
                {/* ARDICILLIQ / SEQUENCE */}
                {q.question_type === 'sequence' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">
                      Bəndləri alt-alta yazın. Tələbə aşağıda bənd nömrələrini düzgün ardıcıllıqla bitişik rəqəm kimi yazacaq.
                    </p>
                    {(q.options || []).map((opt, oi) => {
                      const num = String(oi + 1)
                      return (
                        <div key={oi} className="flex items-center gap-2">
                          <span className="w-8 text-center text-xs text-gray-400 shrink-0">{num}</span>
                          <input
                            className={inpSmFlex}
                            placeholder={`${num} — bənd mətni`}
                            value={typeof opt === 'string' ? opt : (opt?.text ?? '')}
                            onChange={(e) => updOpt(idx, oi, e.target.value)}
                          />
                        </div>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => upd(idx, 'options', [...(q.options || []), ''])}
                      className="text-xs text-indigo-400"
                    >
                      + Bənd əlavə et
                    </button>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Düzgün ardıcıllıq (bitişik rəqəmlər)</label>
                      <input
                        className={inpSmFullMono}
                        placeholder="231"
                        value={String(q.correct_answer || '')}
                        onChange={(e) => upd(idx, 'correct_answer', e.target.value.replace(/\D/g, '').slice(0, 120))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tələbəyə nümunə (placeholder)</label>
                      <input
                        className={inpSmFullMono}
                        placeholder="231"
                        value={q.template_hint || ''}
                        onChange={(e) => upd(idx, 'template_hint', e.target.value.replace(/\D/g, '').slice(0, 120))}
                      />
                    </div>
                  </div>
                )}

                {/* ACIQ */}
                {q.question_type === 'open' && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Cavab sahesin placeholder (telebe gore numunen):</label>
                      <input className={inpSmFull}
                        placeholder="3.5" value={q.template_hint}
                        onChange={e => upd(idx, 'template_hint', e.target.value)} />
                    </div>
                    <p className="text-xs text-gray-500">Aciq suallar muellim terefdinden qiymetlendirilir. Yanlis bala tesir etmir.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
 
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1 justify-center">← Geri</Button>
            <Button onClick={() => setStep(3)} className="flex-1 justify-center">Novbeti → Telebeler</Button>
          </div>
        </div>
      )}
 
      {/* STEP 3 */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Telebeleri sec</span>
            <button onClick={() => setMeta(p => ({
              ...p, student_ids: p.student_ids.length === students.length ? [] : students.map(s => s.id)
            }))} className="text-xs text-blue-400">
              {meta.student_ids.length === students.length ? 'Hamisini sil' : 'Hamisini sec'}
            </button>
          </div>
          <p className="text-xs text-amber-200/85 leading-relaxed">
            Heç kim seçilməsə, imtahan saxlananda server avtomatik olaraq sizin <strong className="text-amber-100">bütün aktiv qeydiyyatlı</strong> tələbələrinizi təyin edir.
            Yenə də &quot;Hamısını seç&quot; etmək daha aydındır.
          </p>
 
          <div className="max-h-64 overflow-y-auto space-y-1 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 p-3">
            {studentsLoading ? (
              <p className="text-token-textMuted text-sm text-center py-8">Tələbələr yüklənir…</p>
            ) : !students.length ? (
              <p className="text-amber-200/80 text-sm text-center py-6 px-2">
                Hələ tələbə yoxdur — əvvəl &quot;Tələbələrim&quot; bölməsindən əlavə edin.
              </p>
            ) : (
              students.map((s) => (
                <label key={s.id} className="flex items-center gap-3 cursor-pointer rounded-lg p-2 hover:bg-token-surfaceCardHover/40">
                  <input
                    type="checkbox"
                    className="accent-blue-500"
                    checked={meta.student_ids.includes(s.id)}
                    onChange={(e) =>
                      setMeta((p) => ({
                        ...p,
                        student_ids: e.target.checked
                          ? [...p.student_ids, s.id]
                          : p.student_ids.filter((id) => id !== s.id),
                      }))
                    }
                  />
                  <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                    {s.full_name?.split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <span className="text-sm text-token-textMain font-medium min-w-0 break-words">{s.full_name}</span>
                </label>
              ))
            )}
          </div>
 
          <p className="text-xs text-gray-500">{meta.student_ids.length} telebe · {questions.length} sual</p>
 
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(2)} className="flex-1 justify-center">← Geri</Button>
            <Button onClick={submit} loading={loading} className="flex-1 justify-center">Imtahan Yarat</Button>
          </div>
        </div>
      )}
    </div>
  )
}
 
