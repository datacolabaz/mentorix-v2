import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'

export default function InstructorAttendance() {
  const [students, setStudents] = useState([])
  const [form, setForm] = useState({ enrollment_id: '', date: new Date().toISOString().split('T')[0], attended: true, session_score: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  useEffect(() => {
    api.get('/students').then(d => setStudents(d.students || []))
  }, [])

  const submit = async () => {
    if (!form.enrollment_id) { toast('Tələbə seçin', 'error'); return }
    setLoading(true)
    try {
      await api.post('/attendance', form)
      toast('✓ Davamiyyət qeyd edildi!')
      setForm(p => ({ ...p, enrollment_id: '', session_score: '', notes: '' }))
    } catch (err) {
      toast(err.message || 'Xəta', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 min-w-0">
      <h1 className="font-display font-bold text-xl sm:text-2xl mb-6 break-words">Davamiyyət Qeydi</h1>

      <div className="max-w-lg w-full min-w-0">
        <Card className="p-4 sm:p-6 space-y-4 min-w-0 overflow-hidden">
          <div className="min-w-0">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tələbə</label>
            <select className="w-full min-w-0 max-w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-3 sm:px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={form.enrollment_id} onChange={e => setForm(p => ({ ...p, enrollment_id: e.target.value }))}>
              <option value="">— Tələbə seçin —</option>
              {students.map(s => (
                <option key={s.enrollment_id} value={s.enrollment_id}>{s.full_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tarix</label>
              <input type="date" className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Bal (0-100)</label>
              <input type="number" min="0" max="100" placeholder="85" className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                value={form.session_score} onChange={e => setForm(p => ({ ...p, session_score: e.target.value }))} />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
            <label className="text-sm font-medium text-gray-300 shrink-0">İştirak etdi:</label>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {[true, false].map(v => (
                <button key={String(v)} onClick={() => setForm(p => ({ ...p, attended: v }))}
                  className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all ${form.attended === v ? (v ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white') : 'bg-[#13112e] text-gray-400 border border-indigo-500/20'}`}>
                  {v ? '✓ Gəldi' : '✗ Gəlmədi'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Qeyd</label>
            <input placeholder="Əlavə qeyd..." className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>

          <Button onClick={submit} loading={loading} className="w-full justify-center py-3">
            ✅ Davamiyyəti Qeyd Et
          </Button>
        </Card>
      </div>
    </div>
  )
}
