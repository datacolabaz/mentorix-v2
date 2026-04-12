import { useState, useRef } from 'react'
import api from '../../lib/api'
import Button from '../common/Button'
import { useToast } from '../common/Toast'
 
const QUESTION_TYPES = {
  closed: 'Qapalı (ABCDE)',
  matching: 'Uyğunluq',
  multiple: 'Coxsecimli',
  open: 'Aciq',
}
 
const emptyQuestion = (type = 'closed', order = 1) => ({
  id: Date.now() + order,
  question_type: type,
  question_text: '',
  points: 10,
  order_num: order,
  options: type === 'closed' ? ['', '', '', '', ''] :
            type === 'multiple' ? ['', '', '', ''] :
            type === 'matching' ? [{ left: '', right: '' }, { left: '', right: '' }] : [],
  correct_answer: '',
  correct_answers: [],
  template_hint: type === 'open' ? '3.5' : type === 'matching' ? '1a, 2b, 3c' : type === 'multiple' ? '23' : '',
})
 
export default function ExamForm({ students, onCreated }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfUploading, setPdfUploading] = useState(false)
  const fileRef = useRef()
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
 
  const [questions, setQuestions] = useState([emptyQuestion('closed', 1)])
 
  const addQuestion = (type) => setQuestions(prev => [...prev, emptyQuestion(type, prev.length + 1)])
  const updateQuestion = (idx, field, value) => setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q))
  const updateOption = (qIdx, optIdx, value) => setQuestions(prev => prev.map((q, i) => {
    if (i !== qIdx) return q
    const opts = [...q.options]; opts[optIdx] = value
    return { ...q, options: opts }
  }))
  const updateMatchingOption = (qIdx, optIdx, side, value) => setQuestions(prev => prev.map((q, i) => {
    if (i !== qIdx) return q
    const opts = [...q.options]; opts[optIdx] = { ...opts[optIdx], [side]: value }
    return { ...q, options: opts }
  }))
  const removeQuestion = (idx) => setQuestions(prev => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order_num: i + 1 })))
 
  const handlePdfUpload = async (file) => {
    if (!file) return
    setPdfUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const data = await api.upload('/exams/upload', formData)
      setPdfFile({ name: file.name, url: data.url })
      toast('PDF yuklendi')
    } catch (err) {
      toast(err.message || 'PDF yukleme xetasi', 'error')
    } finally { setPdfUploading(false) }
  }
 
  const submit = async () => {
    if (!meta.title || !meta.start_time) { toast('Ad ve vaxti daxil edin', 'error'); return }
    setLoading(true)
    try {
      await api.post('/exams', {
        ...meta,
        pdf_url: pdfFile?.url || null,
        questions: questions.map(q => ({
          question_text: q.question_text,
          question_type: q.question_type,
          points: q.points,
          order_num: q.order_num,
          negative_marking: q.question_type === 'closed' ? -0.25 : 0,
          options: q.question_type === 'closed' || q.question_type === 'multiple'
            ? q.options.map((o, i) => ({ key: String.fromCharCode(65 + i), text: o }))
            : q.options,
          correct_answer: q.correct_answer,
          correct_answers: q.correct_answers,
          template_hint: q.template_hint,
        })),
      })
      toast('Imtahan yaradildi!')
      onCreated?.()
    } catch (err) {
      toast(err.message || 'Xeta', 'error')
    } finally { setLoading(false) }
  }
 
  const inp = 'w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500'
 
  return (
    <div>
      <div className="flex mb-6">
        {['Umumi', 'Suallar', 'Telebeler'].map((s, i) => (
          <button key={i} onClick={() => setStep(i + 1)}
            className={'flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors ' + (step === i + 1 ? 'border-blue-500 text-blue-400' : 'border-indigo-500/20 text-gray-500')}>
            {i + 1}. {s}
          </button>
        ))}
      </div>
 
      {/* STEP 1 - UMUMI */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Imtahan Adi *</label>
            <input className={inp} placeholder="Riyaziyyat Yarimil Imtahani" value={meta.title} onChange={e => setMeta(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fenn</label>
              <input className={inp} placeholder="Riyaziyyat" value={meta.subject} onChange={e => setMeta(p => ({ ...p, subject: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Movzu</label>
              <input className={inp} placeholder="Inteqral" value={meta.topic} onChange={e => setMeta(p => ({ ...p, topic: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Baslama Vaxti *</label>
              <input type="datetime-local" className={inp} value={meta.start_time} onChange={e => setMeta(p => ({ ...p, start_time: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Muddet (deq)</label>
              <input type="number" className={inp} value={meta.duration_minutes} onChange={e => setMeta(p => ({ ...p, duration_minutes: parseInt(e.target.value) }))} />
            </div>
          </div>
 
          <div className="p-4 bg-[#13112e] rounded-xl border border-indigo-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold">SMS bildirisi gonder</span>
                <p className="text-xs text-gray-500 mt-0.5">Imtahana 5 deqiqe qalmis telebelere SMS geder</p>
              </div>
              <input type="checkbox" checked={meta.notify_students} onChange={e => setMeta(p => ({ ...p, notify_students: e.target.checked }))} className="w-4 h-4 accent-blue-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Neticeni telebeye goster</span>
              <input type="checkbox" checked={meta.show_results} onChange={e => setMeta(p => ({ ...p, show_results: e.target.checked }))} className="w-4 h-4 accent-blue-500" />
            </div>
          </div>
 
          <div className="p-4 bg-[#13112e] rounded-xl border border-indigo-500/20">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">PDF Fayl (suallar PDF-dedirsə)</label>
            <div className="flex gap-3 items-center">
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                onChange={e => handlePdfUpload(e.target.files[0])} />
              <button onClick={() => fileRef.current?.click()}
                className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl text-sm font-semibold hover:bg-blue-500/30 transition-colors">
                {pdfUploading ? 'Yuklenir...' : 'Fayl Sec'}
              </button>
              {pdfFile && <span className="text-xs text-emerald-400 flex-1 truncate">{pdfFile.name}</span>}
              {!pdfFile && <span className="text-xs text-gray-500">PDF ve ya sekil secin</span>}
            </div>
          </div>
 
          <Button onClick={() => setStep(2)} className="w-full justify-center">Novbeti Suallar</Button>
        </div>
      )}
 
      {/* STEP 2 - SUALLAR */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {Object.entries(QUESTION_TYPES).map(([type, label]) => (
              <button key={type} onClick={() => addQuestion(type)}
                className="px-3 py-1.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl hover:bg-indigo-500/30 transition-colors">
                + {label}
              </button>
            ))}
          </div>
 
          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
            {questions.map((q, idx) => (
              <div key={q.id} className="p-4 bg-[#13112e] rounded-xl border border-indigo-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-300 uppercase">{idx + 1}. {QUESTION_TYPES[q.question_type]}</span>
                    {q.question_type === 'closed' && (
                      <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-lg">-0.25 mənfi</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" max="100" value={q.points}
                      onChange={e => updateQuestion(idx, 'points', parseInt(e.target.value))}
                      className="w-14 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-2 py-1 text-white text-xs text-center outline-none" />
                    <span className="text-xs text-gray-500">bal</span>
                    <button onClick={() => removeQuestion(idx)} className="text-red-400 text-sm ml-1">✕</button>
                  </div>
                </div>
 
                <textarea className="w-full bg-[#1a1740] border border-indigo-500/20 rounded-xl p-3 text-white text-sm resize-none outline-none focus:border-blue-500 mb-3"
                  rows={2} placeholder="Sual metni..." value={q.question_text}
                  onChange={e => updateQuestion(idx, 'question_text', e.target.value)} />
 
                {/* QAPALI */}
                {q.question_type === 'closed' && (
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => {
                      const key = String.fromCharCode(65 + oi)
                      return (
                        <div key={oi} className="flex items-center gap-2">
                          <span onClick={() => updateQuestion(idx, 'correct_answer', key)}
                            className={'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer flex-shrink-0 ' + (q.correct_answer === key ? 'bg-emerald-500 text-white' : 'bg-[#1a1740] text-gray-400 border border-indigo-500/20')}>
                            {key}
                          </span>
                          <input className="flex-1 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-blue-500"
                            placeholder={key + ' varianti'} value={opt} onChange={e => updateOption(idx, oi, e.target.value)} />
                        </div>
                      )
                    })}
                    <p className="text-xs text-gray-500 mt-1">Duzgun cavabi secmek ucun herfin uzerine basin. Her 4 yanlis 1 duzgunun balini aparir.</p>
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
                            onChange={e => updateQuestion(idx, 'correct_answers', e.target.checked ? [...(q.correct_answers || []), key] : (q.correct_answers || []).filter(k => k !== key))} />
                          <span className="w-5 text-xs font-bold text-gray-400">{key}</span>
                          <input className="flex-1 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-blue-500"
                            placeholder={key + ' varianti'} value={opt} onChange={e => updateOption(idx, oi, e.target.value)} />
                        </div>
                      )
                    })}
                    <button onClick={() => updateQuestion(idx, 'options', [...q.options, ''])} className="text-xs text-indigo-400">+ Variant elave et</button>
                    <div className="mt-2">
                      <label className="block text-xs text-gray-500 mb-1">Telebe cavab sablonu (mes: 23 - 2 ve 3-cu secimler dogrudur):</label>
                      <input className="w-full bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none"
                        placeholder="23" value={q.template_hint} onChange={e => updateQuestion(idx, 'template_hint', e.target.value)} />
                    </div>
                  </div>
                )}
 
                {/* UYGUNLUQ */}
                {q.question_type === 'matching' && (
                  <div className="space-y-2">
                    {q.options.map((pair, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-4">{oi + 1}</span>
                        <input className="flex-1 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-blue-500"
                          placeholder="Sol teref" value={pair.left || ''} onChange={e => updateMatchingOption(idx, oi, 'left', e.target.value)} />
                        <span className="text-gray-500">↔</span>
                        <input className="flex-1 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-blue-500"
                          placeholder="Sag teref" value={pair.right || ''} onChange={e => updateMatchingOption(idx, oi, 'right', e.target.value)} />
                        <button onClick={() => updateQuestion(idx, 'options', q.options.filter((_, i) => i !== oi))} className="text-red-400 text-xs">✕</button>
                      </div>
                    ))}
                    <button onClick={() => updateQuestion(idx, 'options', [...q.options, { left: '', right: '' }])} className="text-xs text-indigo-400">+ Cut elave et</button>
                    <div className="mt-2">
                      <label className="block text-xs text-gray-500 mb-1">Telebe cavab sablonu (mes: 1b2c3a):</label>
                      <input className="w-full bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none"
                        placeholder="1b2c3a" value={q.template_hint} onChange={e => updateQuestion(idx, 'template_hint', e.target.value)} />
                    </div>
                  </div>
                )}
 
                {/* ACIQ */}
                {q.question_type === 'open' && (
                  <div className="space-y-2">
                    <div className="p-3 bg-[#1a1740] rounded-xl border border-indigo-500/20">
                      <p className="text-xs text-gray-400 mb-2">Telebe cavab sahesi - placeholder:</p>
                      <input className="w-full bg-[#13112e] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none"
                        placeholder="Placeholder (mes: 3.5)" value={q.template_hint}
                        onChange={e => updateQuestion(idx, 'template_hint', e.target.value)} />
                      <p className="text-xs text-gray-500 mt-2">Aciq suallar muellim terefdinden qiymetlendirilir. Yanlis cavab bala tesir etmir.</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
 
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1 justify-center">Geri</Button>
            <Button onClick={() => setStep(3)} className="flex-1 justify-center">Novbeti Telebeler</Button>
          </div>
        </div>
      )}
 
      {/* STEP 3 - TELEBELER */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Telebeleri sec</span>
            <button onClick={() => setMeta(p => ({ ...p, student_ids: p.student_ids.length === students.length ? [] : students.map(s => s.id) }))}
              className="text-xs text-blue-400 hover:text-blue-300">
              {meta.student_ids.length === students.length ? 'Hamisini sil' : 'Hamisini sec'}
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2 bg-[#13112e] rounded-xl p-3 border border-indigo-500/20">
            {students.map(s => (
              <label key={s.id} className="flex items-center gap-3 cursor-pointer hover:bg-white/5 rounded-lg p-2">
                <input type="checkbox" className="accent-blue-500"
                  checked={meta.student_ids.includes(s.id)}
                  onChange={e => setMeta(p => ({ ...p, student_ids: e.target.checked ? [...p.student_ids, s.id] : p.student_ids.filter(id => id !== s.id) }))} />
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">
                  {s.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <span className="text-sm text-white">{s.full_name}</span>
              </label>
            ))}
          </div>
          <div className="text-xs text-gray-500">{meta.student_ids.length} telebe secildi</div>
 
          {meta.notify_students && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-xs text-blue-300">SMS imtahana 5 deqiqe qalmis secilmis telebelerin valideyninə gonderilecek.</p>
            </div>
          )}
 
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(2)} className="flex-1 justify-center">Geri</Button>
            <Button onClick={submit} loading={loading} className="flex-1 justify-center">Imtahan Yarat</Button>
          </div>
        </div>
      )}
    </div>
  )
}
