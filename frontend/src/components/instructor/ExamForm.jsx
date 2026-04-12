import { useState } from 'react'
import api from '../../lib/api'
import { localDatetimeInputToUtcIso } from '../../lib/examDatetime'
import Button from '../common/Button'
import { useToast } from '../common/Toast'
 
const TYPES = {
  closed: 'Qapali (ABCDE)',
  matching: 'Uygunluq',
  multiple: 'Coxsecimli',
  open: 'Aciq',
}
 
export default function ExamForm({ students, onCreated }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const toast = useToast()

  const [meta, setMeta] = useState({
    title: '',
    subject: '',
    topic: '',
    duration_minutes: 60,
    start_time: '',
    notify_students: false,
    show_results: true,
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
    correct_answers: [],
    options: type === 'closed' ? ['', '', '', '', ''] :
              type === 'multiple' ? ['', '', '', ''] :
              type === 'matching' ? [{ left: '', right: '' }, { left: '', right: '' }] : [],
    template_hint: type === 'open' ? '3.5' : type === 'matching' ? '1b2c3a' : type === 'multiple' ? '23' : '',
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
    if (!meta.title || !meta.start_time) { toast('Ad ve vaxt teleb olunur', 'error'); return }
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
        pdf_url: exam_files[0]?.url || null,
        exam_files,
        start_time: localDatetimeInputToUtcIso(meta.start_time),
        questions: questions.map((q, i) => ({
          question_text: `Sual ${i + 1}`,
          question_type: q.question_type,
          points: q.points,
          order_num: q.order_num,
          negative_marking: q.question_type === 'closed' ? -0.25 : 0,
          options: q.question_type === 'closed' || q.question_type === 'multiple'
            ? q.options.map((o, j) => ({
                key: String.fromCharCode(65 + j),
                text: typeof o === 'string' ? o : (o?.text ?? ''),
              }))
            : q.options,
          correct_answer: q.correct_answer,
          correct_answers: q.correct_answers,
          template_hint: q.template_hint,
        })),
      })
      toast('Imtahan yaradildi!')
      onCreated?.()
    } catch (err) { toast(err.message || 'Xeta', 'error') }
    finally { setLoading(false) }
  }
 
  const inp = 'w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500'
 
  return (
    <div>
      {/* Addimlar */}
      <div className="flex mb-6">
        {['Umumi', 'Suallar', 'Telebeler'].map((s, i) => (
          <button key={i} onClick={() => setStep(i + 1)}
            className={'flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors ' +
              (step === i + 1 ? 'border-blue-500 text-blue-400' : 'border-indigo-500/20 text-gray-500')}>
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
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Baslama Vaxti *</label>
              <input type="datetime-local" className={inp}
                value={meta.start_time} onChange={e => setMeta(p => ({ ...p, start_time: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Muddet (deq)</label>
              <input type="number" className={inp}
                value={meta.duration_minutes} onChange={e => setMeta(p => ({ ...p, duration_minutes: parseInt(e.target.value) }))} />
            </div>
          </div>
 
          <div className="p-4 bg-[#13112e] rounded-xl border border-indigo-500/20 space-y-3">
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
                    className="flex items-center justify-between gap-2 text-xs bg-[#1a1740] rounded-lg px-3 py-2 border border-indigo-500/20"
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
 
          <div className="p-4 bg-[#13112e] rounded-xl border border-indigo-500/20 space-y-3">
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
          </div>
 
          <Button onClick={() => setStep(2)} className="w-full justify-center">Novbeti → Suallar</Button>
        </div>
      )}
 
      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400 bg-[#13112e] border border-indigo-500/20 rounded-xl p-3">
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
              <div className="text-center py-10 text-gray-500 text-sm bg-[#13112e] rounded-xl border border-indigo-500/20">
                Yuxaridan sual tipi secin
              </div>
            )}
            {questions.map((q, idx) => (
              <div key={q.id} className="p-4 bg-[#13112e] rounded-xl border border-indigo-500/20">
                {/* Sual basligi */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-300">{idx + 1}. {TYPES[q.question_type]}</span>
                    {q.question_type === 'closed' && (
                      <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-lg">-0.25 menfi</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" max="100" value={q.points}
                      onChange={e => upd(idx, 'points', parseInt(e.target.value))}
                      className="w-14 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-2 py-1 text-white text-xs text-center outline-none" />
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
                              (q.correct_answer === key ? 'bg-emerald-500 text-white' : 'bg-[#1a1740] text-gray-400 border border-indigo-500/20')}>
                            {key}
                          </span>
                          <input className="flex-1 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-blue-500"
                            placeholder={key + ' varianti'} value={opt}
                            onChange={e => updOpt(idx, oi, e.target.value)} />
                        </div>
                      )
                    })}
                    <p className="text-xs text-gray-500">Duzgun cavabi secmek ucun herfin uzerine basin.</p>
                  </div>
                )}
 
                {/* COXSECIMLI */}
                {q.question_type === 'multiple' && (
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => {
                      const key = String.fromCharCode(65 + oi)
                      return (
                        <div key={oi} className="flex items-center gap-2">
                          <input type="checkbox" className="accent-emerald-500"
                            checked={q.correct_answers?.includes(key)}
                            onChange={e => upd(idx, 'correct_answers', e.target.checked
                              ? [...(q.correct_answers || []), key]
                              : (q.correct_answers || []).filter(k => k !== key))} />
                          <span className="w-5 text-xs text-gray-400">{key}</span>
                          <input className="flex-1 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-blue-500"
                            placeholder={key + ' varianti'} value={opt}
                            onChange={e => updOpt(idx, oi, e.target.value)} />
                        </div>
                      )
                    })}
                    <button onClick={() => upd(idx, 'options', [...q.options, ''])}
                      className="text-xs text-indigo-400">+ Variant elave et</button>
                    <p className="text-xs text-gray-500 mt-1">
                      Telebe sablon: <span className="font-mono text-indigo-300">{q.template_hint}</span>
                      <span className="ml-1">(dogru secimler bitisik yazilir)</span>
                    </p>
                  </div>
                )}
 
                {/* UYGUNLUQ */}
                {q.question_type === 'matching' && (
                  <div className="space-y-2">
                    {q.options.map((pair, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-4">{oi + 1}</span>
                        <input className="flex-1 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-blue-500"
                          placeholder="Sol" value={pair.left || ''}
                          onChange={e => updMatch(idx, oi, 'left', e.target.value)} />
                        <span className="text-gray-500 text-xs">→</span>
                        <input className="flex-1 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-blue-500"
                          placeholder="Sag" value={pair.right || ''}
                          onChange={e => updMatch(idx, oi, 'right', e.target.value)} />
                        <button onClick={() => upd(idx, 'options', q.options.filter((_, i) => i !== oi))}
                          className="text-red-400 text-xs">✕</button>
                      </div>
                    ))}
                    <button onClick={() => upd(idx, 'options', [...q.options, { left: '', right: '' }])}
                      className="text-xs text-indigo-400">+ Cut elave et</button>
                    <p className="text-xs text-gray-500 mt-1">
                      Telebe sablon: <span className="font-mono text-indigo-300">{q.template_hint}</span>
                    </p>
                  </div>
                )}
 
                {/* ACIQ */}
                {q.question_type === 'open' && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Cavab sahesin placeholder (telebe gore numunen):</label>
                      <input className="w-full bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-blue-500"
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
 
          <div className="max-h-64 overflow-y-auto space-y-1 bg-[#13112e] rounded-xl p-3 border border-indigo-500/20">
            {students.map(s => (
              <label key={s.id} className="flex items-center gap-3 cursor-pointer hover:bg-white/5 rounded-lg p-2">
                <input type="checkbox" className="accent-blue-500"
                  checked={meta.student_ids.includes(s.id)}
                  onChange={e => setMeta(p => ({
                    ...p, student_ids: e.target.checked
                      ? [...p.student_ids, s.id]
                      : p.student_ids.filter(id => id !== s.id)
                  }))} />
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">
                  {s.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <span className="text-sm">{s.full_name}</span>
              </label>
            ))}
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
 
