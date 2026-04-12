import { useState } from 'react'
import api from '../../lib/api'
import Button from '../common/Button'
import { useToast } from '../common/Toast'
 
export default function ExamForm({ students, onCreated }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
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
 
  const [questions, setQuestions] = useState([])
 
  const addQuestion = (type) => {
    setQuestions(prev => [...prev, {
      id: Date.now(),
      question_type: type,
      points: 10,
      order_num: prev.length + 1,
      correct_answer: '',
      correct_answers: [],
      options: type === 'closed' ? ['', '', '', '', ''] : type === 'multiple' ? ['', '', '', ''] : type === 'matching' ? [{left:'',right:''},{left:'',right:''}] : [],
      template_hint: type === 'open' ? '3.5' : type === 'matching' ? '1b2c3a' : type === 'multiple' ? '23' : '',
    }])
  }
 
  const updateQuestion = (idx, field, value) =>
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q))
 
  const updateOption = (qIdx, optIdx, value) =>
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q
      const opts = [...q.options]; opts[optIdx] = value
      return { ...q, options: opts }
    }))
 
  const updateMatchOpt = (qIdx, optIdx, side, value) =>
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q
      const opts = [...q.options]; opts[optIdx] = { ...opts[optIdx], [side]: value }
      return { ...q, options: opts }
    }))
 
  const submit = async () => {
    if (!meta.title || !meta.start_time) { toast('Ad ve vaxt tələb olunur', 'error'); return }
    setLoading(true)
    try {
      await api.post('/exams', {
        ...meta,
        questions: questions.map(q => ({
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
    } catch (err) { toast(err.message || 'Xeta', 'error') }
    finally { setLoading(false) }
  }
 
  const inp = 'w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500'
  const TYPES = { closed: 'Qapali (ABCDE)', matching: 'Uygunluq', multiple: 'Coxsecimli', open: 'Aciq' }
 
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
                <p className="text-sm font-semibold">SMS bildirisi</p>
                <p className="text-xs text-gray-500">Imtahana 5 deq qalmis telebelere SMS geder</p>
              </div>
              <input type="checkbox" checked={meta.notify_students} onChange={e => setMeta(p => ({ ...p, notify_students: e.target.checked }))} className="w-4 h-4 accent-blue-500" />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Neticeni telebeye goster</p>
              <input type="checkbox" checked={meta.show_results} onChange={e => setMeta(p => ({ ...p, show_results: e.target.checked }))} className="w-4 h-4 accent-blue-500" />
            </div>
          </div>
          <Button onClick={() => setStep(2)} className="w-full justify-center">Novbeti Suallar</Button>
        </div>
      )}
 
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400 bg-[#13112e] border border-indigo-500/20 rounded-xl p-3">
            PDF-deki her sual ucun tipini secin. Sual metni PDF-dedir.
          </p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(TYPES).map(([type, label]) => (
              <button key={type} onClick={() => addQuestion(type)}
                className="px-3 py-2 text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl hover:bg-indigo-500/30 transition-colors">
                + {label}
              </button>
            ))}
          </div>
 
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {questions.map((q, idx) => (
              <div key={q.id} className="p-4 bg-[#13112e] rounded-xl border border-indigo-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-300">{idx + 1}. {TYPES[q.question_type]}</span>
                    {q.question_type === 'closed' && (
                      <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-lg">-0.25 menfi</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" max="100" value={q.points}
                      onChange={e => updateQuestion(idx, 'points', parseInt(e.target.value))}
                      className="w-14 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-2 py-1 text-white text-xs text-center outline-none" />
                    <span className="text-xs text-gray-500">bal</span>
                    <button onClick={() => setQuestions(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 text-sm">✕</button>
                  </div>
                </div>
 
                {q.question_type === 'closed' && (
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => {
                      const key = String.fromCharCode(65 + oi)
                      return (
                        <div key={oi} className="flex items-center gap-2">
                          <span onClick={() => updateQuestion(idx, 'correct_answer', key)}
                            className={'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer ' + (q.correct_answer === key ? 'bg-emerald-500 text-white' : 'bg-[#1a1740] text-gray-400 border border-indigo-500/20')}>
                            {key}
                          </span>
                          <input className="flex-1 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-blue-500"
                            placeholder={key + ' varianti'} value={opt} onChange={e => updateOption(idx, oi, e.target.value)} />
                        </div>
                      )
                    })}
                    <p className="text-xs text-gray-500">Duzgun cavabi secmek ucun herfin uzerine basin.</p>
                  </div>
                )}
 
                {q.question_type === 'multiple' && (
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => {
                      const key = String.fromCharCode(65 + oi)
                      return (
                        <div key={oi} className="flex items-center gap-2">
                          <input type="checkbox" className="accent-emerald-500"
                            checked={q.correct_answers?.includes(key)}
                            onChange={e => updateQuestion(idx, 'correct_answers', e.target.checked ? [...(q.correct_answers||[]), key] : (q.correct_answers||[]).filter(k => k !== key))} />
                          <span className="w-5 text-xs text-gray-400">{key}</span>
                          <input className="flex-1 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-blue-500"
                            placeholder={key + ' varianti'} value={opt} onChange={e => updateOption(idx, oi, e.target.value)} />
                        </div>
                      )
                    })}
                    <p className="text-xs text-gray-500">Sablon (telebe bele yazacaq): <span className="text-indigo-300 font-mono">{q.template_hint || '23'}</span></p>
                  </div>
                )}
 
                {q.question_type === 'matching' && (
                  <div className="space-y-2">
                    {q.options.map((pair, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-4">{oi + 1}</span>
                        <input className="flex-1 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none"
                          placeholder="Sol" value={pair.left||''} onChange={e => updateMatchOpt(idx, oi, 'left', e.target.value)} />
                        <span className="text-gray-500 text-xs">→</span>
                        <input className="flex-1 bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none"
                          placeholder="Sag" value={pair.right||''} onChange={e => updateMatchOpt(idx, oi, 'right', e.target.value)} />
                        <button onClick={() => updateQuestion(idx, 'options', q.options.filter((_, i) => i !== oi))} className="text-red-400 text-xs">✕</button>
                      </div>
                    ))}
                    <button onClick={() => updateQuestion(idx, 'options', [...q.options, {left:'',right:''}])} className="text-xs text-indigo-400">+ Cut elave et</button>
                    <p className="text-xs text-gray-500">Sablon: <span className="text-indigo-300 font-mono">{q.template_hint || '1b2c3a'}</span></p>
                  </div>
                )}
 
                {q.question_type === 'open' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cavab sablonu (placeholder):</label>
                    <input className="w-full bg-[#1a1740] border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none"
                      placeholder="3.5" value={q.template_hint} onChange={e => updateQuestion(idx, 'template_hint', e.target.value)} />
                    <p className="text-xs text-gray-500 mt-1">Muellim terefdinden qiymetlendirilir.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
 
          {questions.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm bg-[#13112e] rounded-xl border border-indigo-500/20">
              Yuxaridan sual tipi secin
            </div>
          )}
 
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1 justify-center">Geri</Button>
            <Button onClick={() => setStep(3)} className="flex-1 justify-center">Novbeti Telebeler</Button>
          </div>
        </div>
      )}
 
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Telebeleri sec</span>
            <button onClick={() => setMeta(p => ({ ...p, student_ids: p.student_ids.length === students.length ? [] : students.map(s => s.id) }))}
              className="text-xs text-blue-400">{meta.student_ids.length === students.length ? 'Hamisini sil' : 'Hamisini sec'}</button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2 bg-[#13112e] rounded-xl p-3 border border-indigo-500/20">
            {students.map(s => (
              <label key={s.id} className="flex items-center gap-3 cursor-pointer hover:bg-white/5 rounded-lg p-2">
                <input type="checkbox" className="accent-blue-500"
                  checked={meta.student_ids.includes(s.id)}
                  onChange={e => setMeta(p => ({ ...p, student_ids: e.target.checked ? [...p.student_ids, s.id] : p.student_ids.filter(id => id !== s.id) }))} />
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">
                  {s.full_name?.split(' ').map(n => n[0]).join('').slice(0,2)}
                </div>
                <span className="text-sm">{s.full_name}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500">{meta.student_ids.length} telebe secildi · {questions.length} sual</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(2)} className="flex-1 justify-center">Geri</Button>
            <Button onClick={submit} loading={loading} className="flex-1 justify-center">Imtahan Yarat</Button>
          </div>
        </div>
      )}
    </div>
  )
}
 
