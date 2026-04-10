import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'

export default function AdminInstructors() {
  const [instructors, setInstructors] = useState([])
  const [addModal, setAddModal] = useState(false)
  const [limitsModal, setLimitsModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: 'Pass@123', subject: '', billing_type: '8_lessons' })
  const [limits, setLimits] = useState({})
  const toast = useToast()

  const load = () => api.get('/admin/instructors').then(d => setInstructors(d.instructors || []))
  useEffect(() => { load() }, [])

  const addInstructor = async () => {
    setLoading(true)
    try {
      await api.post('/auth/register', { ...form, role: 'instructor' })
      toast('Muellim elave edildi!')
      setAddModal(false)
      setForm({ full_name: '', email: '', phone: '', password: 'Pass@123', subject: '', billing_type: '8_lessons' })
      load()
    } catch (err) {
      toast(err.message || 'Xeta', 'error')
    } finally { setLoading(false) }
  }

  const openLimits = (i) => {
    setSelected(i)
    setLimits({ sms_limit: i.sms_limit, storage_limit_mb: i.storage_limit_mb, ram_limit_mb: i.ram_limit_mb, max_concurrent_students: i.max_concurrent_students })
    setLimitsModal(true)
  }

  const saveLimits = async () => {
    await api.patch(`/admin/instructors/${selected.id}/limits`, limits)
    toast('Limitler yadda saxlandi!')
    setLimitsModal(false)
    load()
  }

  const toggle = async (i) => {
    await api.patch(`/admin/instructors/${i.id}/toggle`, { is_active: !i.is_active })
    toast(i.is_active ? 'Deaktiv edildi' : 'Aktiv edildi')
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl">Muellimler</h1>
        <Button onClick={() => setAddModal(true)}>+ Muellim Elave Et</Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-indigo-500/20 text-gray-400 text-xs uppercase">
              {['Ad', 'Fenn', 'Telebe', 'SMS', 'Storage', 'Status', 'Emeliyyat'].map(h => (
                <th key={h} className="py-3 px-4 text-left font-semibold tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {instructors.map(i => (
              <tr key={i.id} className="border-b border-indigo-500/10 hover:bg-indigo-500/5 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-semibold text-white">{i.full_name}</div>
                  <div className="text-xs text-gray-400">{i.email}</div>
                </td>
                <td className="py-3 px-4 text-gray-300">{i.subject || '-'}</td>
                <td className="py-3 px-4 text-gray-300">{i.student_count || 0}</td>
                <td className="py-3 px-4 text-xs">
                  <span className="text-blue-400 font-semibold">{i.sms_used || 0}</span>
                  <span className="text-gray-500">/{i.sms_limit || 100}</span>
                </td>
                <td className="py-3 px-4 text-xs text-gray-400">{i.storage_limit_mb || 1024}MB</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${i.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {i.is_active ? 'Aktiv' : 'Deaktiv'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openLimits(i)}>Limitler</Button>
                    <Button size="sm" variant={i.is_active ? 'danger' : 'ghost'} onClick={() => toggle(i)}>
                      {i.is_active ? 'Deaktiv' : 'Aktiv'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!instructors.length && <div className="text-center py-12 text-gray-500">Muellim tapilmadi</div>}
      </Card>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Yeni Muellim">
        <div className="space-y-4">
          {[
            { key: 'full_name', label: 'Ad Soyad', placeholder: 'Ali Huseynov' },
            { key: 'email', label: 'E-poct', placeholder: 'muellim@email.com', type: 'email' },
            { key: 'phone', label: 'Telefon', placeholder: '+994501234567' },
            { key: 'subject', label: 'Fenn', placeholder: 'Riyaziyyat' },
            { key: 'password', label: 'Sifre', placeholder: 'Pass@123', type: 'password' },
          ].map(({ key, label, placeholder, type = 'text' }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</label>
              <input type={type} placeholder={placeholder} className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500" value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Billing Novu</label>
            <select className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500" value={form.billing_type} onChange={e => setForm(p => ({ ...p, billing_type: e.target.value }))}>
              <option value="8_lessons">8 Ders</option>
              <option value="12_lessons">12 Ders</option>
              <option value="monthly">Ayliq</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={addInstructor} loading={loading} className="flex-1 justify-center">Elave Et</Button>
            <Button variant="secondary" onClick={() => setAddModal(false)} className="flex-1 justify-center">Legv et</Button>
          </div>
        </div>
      </Modal>

      <Modal open={limitsModal} onClose={() => setLimitsModal(false)} title={`${selected?.full_name} - Limitler`}>
        <div className="space-y-4">
          {[
            { key: 'sms_limit', label: 'Ayliq SMS Limiti' },
            { key: 'storage_limit_mb', label: 'Storage Limiti (MB)' },
            { key: 'ram_limit_mb', label: 'RAM Limiti (MB)' },
            { key: 'max_concurrent_students', label: 'Maks. Eyni Vaxt Telebe' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</label>
              <input type="number" className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500" value={limits[key] || ''} onChange={e => setLimits(p => ({ ...p, [key]: parseInt(e.target.value) }))} />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <Button onClick={saveLimits} className="flex-1 justify-center">Yadda Saxla</Button>
            <Button variant="secondary" onClick={() => setLimitsModal(false)} className="flex-1 justify-center">Legv et</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
