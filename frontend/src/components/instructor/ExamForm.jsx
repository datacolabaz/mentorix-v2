import { useState } from 'react'
import api from '../../lib/api'
import Button from '../common/Button'
import { useToast } from '../common/Toast'

const QUESTION_TYPES = {
  closed: 'Qapalı (ABCDE)',
  matching: 'Uyğunluq',
  multiple: 'Çoxlu seçim',
  open: 'Açıq',
}

const emptyQuestion = (type = 'closed', order = 1) => ({
  id: Date.now() + order,
  question_type: type,
  question_text: '',
  points: 10,
  order_num: order,
  options: type === 'closed' ? ['', '', '', '', ''] : type === 'multiple' ? ['', '', '', ''] : type === 'matching' ? [{ left: '', right: '' }, { left: '', right: '' }] : [],
  correct_answer: '',
  correct_answers: [],
  template_hint: '',
})

export default function ExamForm({ students, onCreated }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const toast = useToast()
  const [meta, setMeta] = useState({ title: '', duration_minutes: 60, start_time: '', notify_enabled: false, notify_before_hours: 1, show_results: true, student_ids: [] })
  const [questions, setQuestions] = useState([emptyQuestion('closed', 1)])

  const addQuestion = (type) => setQuestions(prev => [...prev, emptyQuestion(type, prev.length + 1)])
  const updateQuestion = (idx, field, value) => setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q))
  const updateOption = (qIdx, optIdx, value) => setQuestions(prev => prev.map((q, i) => { if (i !== qIdx) return q; const opts = [...q.options]; opts[optIdx] = value; return { ...q, options: opts } }))
  const updateMatchingOption = (qIdx, optIdx, side, value) => setQuestions(prev => prev.map((q, i) => { if (i !== qIdx) return q; const opts = [...q.options]; opts[optIdx] = { ...opts[optIdx], [side]: value }; return { ...q, options: opts } }))
  const removeQuestion = (idx) => setQuestions(prev => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order_num: i + 1 })))

  const submit = async () => {
    if (!meta.title || !meta.start_time) { toast('Ad və vaxt tələb olunur', 'error'); return }
    setLoading(true)
    try {
      await api.post('/exams', { ...meta, questions: questions.map(q => ({ question_text: q.question_text, question_type: q.question_type, points: q.points, order_num: q.order_num, options: q.question_type === 'closed' || q.question_type === 'multiple' ? q.options.map((o, i) => ({ key: String.fromCharCode(65 + i), text: o })) : q.options, correct_answer: q.correct_answer, correct_answers: q.correct_answers, template_hint: q.template_hint })) })
      toast('✓ İmtahan yaradıldı!')
      onCreated?.()
    } catch (err) { toast(err.message || 'Xəta', 'error') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div className="flex mb-6">
        {['Ümumi', 'Suallar', 'Tələbələr'].map((s, i) => (
          <button key={i} onClick={() => setStep(i + 1)} className={`flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors ${step === i + 1 ? 'border-blue-500 text-blue-400' : 'border-indigo-500/20 text-gray-500'}`}>{i + 1}. {s}</button>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">İmtahan Adı *</label>
            <input className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500" placeholder="Riyaziyyat Yarımillik İmtahanı" value={meta.title} onChange={e => setMeta(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Başlama Vaxtı *</label>
              <input type="datetime-local" className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500" value={meta.start_time} onChange={e => setMeta(p => ({ ...p, start_time: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Müddət (dəq)</label>
              <input type="number" className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500" value={meta.duration_minutes} onChange={e => setMeta(p => ({ ...p, duration_minutes: parseInt(e.target.value) }))} />
            </div>
          </div>
          <div className="p-4 bg-[#13112e] rounded-xl border border-indigo-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">🔔 SMS bildiriş göndər</span>
              <input type="checkbox" checked={meta.notify_enabled} onChange={e => setMeta(p => ({ ...p, notify_enabled: e.target.checked }))} className="w-4 h-4 accent-blue-500" />
            </div>
            {meta.notify_enabled && (
              <div className="flex gap-3">
                {[1, 2].map(h => (
                  <button key={h} onClick={() => setMeta(p => ({ ...p, notify_before_hours: h }))} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${meta.notify_before_hours === h ? 'bg-blue-500 text-white' : 'bg-[#1a1740] text-gray-400 border border-indigo-500/20'}`}>{h} saat əvvəl</button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">📊 Nəticəni tələbəyə göstər</span>
              <input type="checkbox" checked={meta.show_results} onChange={e => setMeta(p => ({ ...p, show_results: e.target.checked }))} className="w-4 h-4 accent-blue-500" />
            </div>
          </div>
          <div className="p-4 bg-[#13112e] rounded-xl border border-indigo-500/20">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">📄 PDF Fayl (ixtiyari)</label>
            <input type="file" accept=".pdf" className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-500/20 file:text-blue-400" />
            <p className="text-xs text-gray-500 mt-2">Suallar PDF-dədirsə yükləyin. Aşağıda da suallar əlavə edə bilərsiniz.</p>
          </div>
          <Button onClick={() => setStep(2)} className="w-full justify-center">Növbəti → Suallar</Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {Object.entries(QUESTION_TYPES).map(([type, label]) => (
              <button key={type} onClick={() => addQuestion(type)} className="px-3 py-1.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl hover:bg-indigo-500/30 transition-colors">+ {label}</button>
            ))}
          </div>
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {questions.map((q, idx) => (
              <div key={q.id} className="p-4 bg-[#13112e] rounded-xl border border-indigo-500/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-indigo-300 uppercase">{idx + 1}. {QUESTION_TYPES[q.question_type]}</span>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" max="100" value={q.points} onChange={e => updateQuestion(idx, 'points', parseInt(e.target.value))} className="w-16 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-2 py-1 text-white text-xs text-center outline-none" />
                    <span className="text-xs text-gray-500">bal</span>
                    <button onClick={() => removeQuestion(idx)} className="text-red-400 text-sm">✕</button>
                  </div>
                </div>
                <textarea className="w-full bg-[#1a1740] border border-indigo-500/20 rounded-xl p-3 text-white text-sm resize-none outline-none focus:border-blue-500 mb-3" rows={2} placeholder="Sual mətni..." value={q.question_text} onChange={e => updateQuestion(idx, 'question_text', e.target.value)} />
                {q.question_type === 'closed' && (
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => { const key = String.fromCharCode(65 + oi); return (
                      <div key={oi} className="flex items-center gap-2">
                        <span onClick={() => updateQuestion(idx, 'correct_answer', key)} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer flex-shrink-0 ${q.correct_answer === key ? 'bg-emerald-500 text-white' : 'bg-[#1a1740] text-gray-400 border border-indigo-500/20'}`}>{key}</span>
                        <input className="flex-1 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-blue-500" placeholder={`${key} variantı`} value={opt} onChange={e => updateOption(idx, oi, e.target.value)} />
                      </div>
                    )})}
                    <p className="text-xs text-gray-500 mt-1">Düzgün cavabı seçmək üçün hərfin üzərinə basın. Hər 4 yanlış 1 düzgünün balını aparır.</p>
                  </div>
                )}
                {q.question_type === 'multiple' && (
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => { const key = String.fromCharCode(65 + oi); return (
                      <div key={oi} className="flex items-center gap-2">
                        <input type="checkbox" className="accent-emerald-500" checked={q.correct_answers?.includes(key)} onChange={e => updateQuestion(idx, 'correct_answers', e.target.checked ? [...(q.correct_answers||[]), key] : (q.correct_answers||[]).filter(k => k !== key))} />
                        <span className="w-5 text-xs font-bold text-gray-400">{key}</span>
                        <input className="flex-1 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-blue-500" placeholder={`${key} variantı`} value={opt} onChange={e => updateOption(idx, oi, e.target.value)} />
                      </div>
                    )})}
                    <button onClick={() => updateQuestion(idx, 'options', [...q.options, ''])} className="text-xs text-indigo-400">+ Variant əlavə et</button>
                    <p className="text-xs text-gray-500">Düzgün cavabları checkbox ilə seçin. Yanlış bala təsir etmir.</p>
                  </div>
                )}
                {q.question_type === 'matching' && (
                  <div className="space-y-2">
                    {q.options.map((pair, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-4">{oi + 1}</span>
                        <input className="flex-1 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-blue-500" placeholder="Sol tərəf" value={pair.left||''} onChange={e => updateMatchingOption(idx, oi, 'left', e.target.value)} />
                        <span className="text-gray-500">↔</span>
                        <input className="flex-1 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-blue-500" placeholder="Sağ tərəf" value={pair.right||''} onChange={e => updateMatchingOption(idx, oi, 'right', e.target.value)} />
                        <button onClick={() => updateQuestion(idx, 'options', q.options.filter((_, i) => i !== oi))} className="text-red-400 text-xs">✕</button>
                      </div>
                    ))}
                    <button onClick={() => updateQuestion(idx, 'options', [...q.options, {left:'',right:''}])} className="text-xs text-indigo-400">+ Cüt əlavə et</button>
                    <div className="mt-2">
                      <label className="block text-xs text-gray-500 mb-1">Tələbəyə şablon (məs: 1a, 2b, 3c):</label>
                      <input className="w-full bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-blue-500" placeholder="1a, 2b, 3c" value={q.template_hint} onChange={e => updateQuestion(idx, 'template_hint', e.target.value)} />
                    </div>
                  </div>
                )}
                {q.question_type === 'open' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tələbəyə şablon (necə cavab versin):</label>
                    <input className="w-full bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-blue-500" placeholder="Cavabı Azərbaycan dilində yazın" value={q.template_hint} onChange={e => updateQuestion(idx, 'template_hint', e.target.value)} />
                    <p className="text-xs text-gray-500 mt-1">Açıq suallar müəllim tərəfindən qiymətləndirilir.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1 justify-center">← Geri</Button>
            <Button onClick={() => setStep(3)} className="flex-1 justify-center">Növbəti → Tələbələr</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Tələbələri seç</span>
            <button onClick={() => setMeta(p => ({ ...p, student_ids: p.student_ids.length === students.length ? [] : students.map(s => s.id) }))} className="text-xs text-blue-400 hover:text-blue-300">{meta.student_ids.length === students.length ? 'Hamısını sil' : 'Hamısını seç'}</button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2 bg-[#13112e] rounded-xl p-3 border border-indigo-500/20">
            {students.map(s => (
              <label key={s.id} className="flex items-center gap-3 cursor-pointer hover:bg-white/5 rounded-lg p-2">
                <input type="checkbox" className="accent-blue-500" checked={meta.student_ids.includes(s.id)} onChange={e => setMeta(p => ({ ...p, student_ids: e.target.checked ? [...p.student_ids, s.id] : p.student_ids.filter(id => id !== s.id) }))} />
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">{s.full_name?.split(' ').map(n => n[0]).join('').slice(0,2)}</div>
                <span className="text-sm text-white">{s.full_name}</span>
              </label>
            ))}
          </div>
          <div className="text-xs text-gray-500">{meta.student_ids.length} tələbə seçildi</div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(2)} className="flex-1 justify-center">← Geri</Button>
            <Button onClick={submit} loading={loading} className="flex-1 justify-center">✓ İmtahan Yarat</Button>
          </div>
        </div>
      )}
    </div>
  )
}
