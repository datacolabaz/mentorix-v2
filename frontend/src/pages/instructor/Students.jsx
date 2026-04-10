import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'

const BILLING = { '8_lessons': '8 Dərs', '12_lessons': '12 Dərs', monthly: 'Aylıq' }

export default function InstructorStudents() {
  const [students, setStudents] = useState([])
  const [addModal, setAddModal] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', billing_type: '8_lessons', referral_notes: '' })
  const [parent, setParent] = useState({ full_name: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const load = () => api.get('/students').then(d => setStudents(d.students || []))
  useEffect(() => { load() }, [])

  const addStudent = async () => {
    setLoading(true)
    try {
      const userData = await api.post('/auth/register', {
        ...form, role: 'student', password: 'Pass@123'
      })
      if (parent.full_name && parent.phone) {
        await api.post('/auth/register', {
          full_name: parent.full_name, phone: parent.phone,
          role: 'parent', password: 'Pass@123'
        }).catch(() => {})
      }
      await api.post('/students/enroll', {
        student_id: userData.user.id,
        billing_type: form.billing_type,
        referral_notes: form.referral_notes
      })
      toast('✓ Tələbə əlavə edildi!')
      setAddModal(false)
      setForm({ full_name: '', email: '', phone: '', billing_type: '8_lessons', referral_notes: '' })
      setParent({ full_name: '', phone: '' })
      load()
    } catch (err) {
      toast(err.message || 'Xəta', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl">Tələbə Siyahısı</h1>
          <p className="text-gray-400 text-sm mt-1">{students.length} tələbə</p>
        </div>
        <Button onClick={() => setAddModal(true)}>+ Tələbə Əlavə Et</Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-indigo-500/20 text-gray-400 text-xs uppercase">
              {['Tələbə', 'Billing', 'Dərs', 'Orta Bal', 'Mənbə', 'Status', 'Əməliyyat'].map(h => (
                <th key={h} className="py-3 px-4 text-left font-semibold tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map(s => {
              const limit = s.billing_type === '8_lessons' ? 8 : s.billing_type === '12_lessons' ? 12 : null
              const isAlert = limit && s.lesson_count >= limit - 2
              return (
                <tr key={s.id} className="border-b border-indigo-500/10 hover:bg-indigo-500/5 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {s.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{s.full_name}</div>
                        <div className="text-xs text-gray-400">{s.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-xs font-semibold">
                      {BILLING[s.billing_type] || s.billing_type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`font-display font-bold ${isAlert ? 'text-yellow-400' : 'text-white'}`}>
                      {s.lesson_count}{limit ? `/${limit}` : ''}
                    </span>
                    {isAlert && <span className="ml-1">⚠️</span>}
                  </td>
                  <td className="py-3 px-4">
                    {s.avg_score ? (
                      <span className={`font-bold ${s.avg_score >= 80 ? 'text-emerald-400' : s.avg_score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {s.avg_score}%
                      </span>
                    ) : <span className="text-gray-500">—</span>}
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs">{s.referral_source || '—'}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${s.enrollment_status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {s.enrollment_status === 'active' ? 'Aktiv' : 'Passiv'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Button size="sm" variant="secondary">Profil</Button>
                  <Button size="sm" variant="danger" onClick={async () => {
                    if (!confirm(s.full_name + ' silinsin?')) return
                    try {
                      await api.delete('/students/enrollment/' + s.enrollment_id)
                      load()
                    } catch(e) { alert('Xeta: ' + e.message) }
                  }}>Sil</Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!students.length && (
          <div className="text-center py-12 text-gray-500">Hələ tələbə yoxdur</div>
        )}
      </Card>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Yeni Tələbə Əlavə Et" size="md">
        <div className="space-y-4">
          {[
            { key: 'full_name', label: 'Ad Soyad', placeholder: 'Əli Hüseynov' },
            { key: 'email', label: 'E-poçt', placeholder: 'ali@email.com', type: 'email' },
            { key: 'phone', label: 'Telefon', placeholder: '+994501234567' },
          ].map(({ key, label, placeholder, type = 'text' }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</label>
              <input type={type} placeholder={placeholder}
                className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500 transition-colors"
                value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
            </div>
          ))}

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Billing Növü</label>
            <select className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={form.billing_type} onChange={e => setForm(p => ({ ...p, billing_type: e.target.value }))}>
              <option value="8_lessons">8 Dərs</option>
              <option value="12_lessons">12 Dərs</option>
              <option value="monthly">Aylıq</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Mənbə</label>
            <input placeholder="Instagram, tövsiyə..." className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={form.referral_notes} onChange={e => setForm(p => ({ ...p, referral_notes: e.target.value }))} />
          </div>

          <div className="border-t border-indigo-500/20 pt-4">
            <p className="text-xs text-gray-400 mb-3">Valideyn məlumatları (ixtiyari)</p>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Valideyn adı" className="bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                value={parent.full_name} onChange={e => setParent(p => ({ ...p, full_name: e.target.value }))} />
              <input placeholder="+994501234567" className="bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                value={parent.phone} onChange={e => setParent(p => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={addStudent} loading={loading} className="flex-1 justify-center">Əlavə Et</Button>
            <Button variant="secondary" onClick={() => setAddModal(false)} className="flex-1 justify-center">Ləğv et</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
