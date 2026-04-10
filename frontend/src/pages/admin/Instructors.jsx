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
      toast('✓ Müəllim əlavə edildi!')
      setAddModal(false)
      setForm({ full_name: '', email: '', phone: '', password: 'Pass@123', subject: '', billing_type: '8_lessons' })
      load()
    } catch (err) {
      toast(err.message || 'Xəta baş verdi', 'error')
    } finally {
      setLoading(false)
    }
  }

  const openLimits = (i) => {
    setSelected(i)
    setLimits({ sms_limit: i.sms_limit, storage_limit_mb: i.storage_limit_mb, ram_limit_mb: i.ram_limit_mb, max_concurrent_students: i.max_concurrent_students })
    setLimitsModal(true)
  }

  const saveLimits = async () => {
    await api.patch(`/admin/instructors/${selected.id}/limits`, limits)
    toast('Limitlər yadda saxlandı!')
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
        <h1 className="font-display font-bold text-2xl">Müəllimlər</h1>
        <Button onClick={() => setAddModal(true)}>+ Müəllim Əlavə Et</Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-indigo-500/20 text-gray-400 text-xs uppercase">
              {['Ad', 'Fənn', 'Tələbə', 'SMS', 'Storage', 'Status', 'Əməliyyat'].map(h => (
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
                <td className="py-3 px-4 text-gray-300">{i.subject || '—'}</td>
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
                    <Button size="sm" variant="secondary" onClick={() => openLimits(i)}>⚙️ Limitlər</Button>
                    <Button size="sm" variant={i.is_active ? 'danger' : 'ghost'} onClick={() => toggle(i)}>
                      {i.is_active ? 'Deaktiv' : 'Aktiv'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!instructors.length && <div className="text-center py-12 text-gray-500">Müəllim tapılmadı</div>}
      </Card>

      {/* Add Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Yeni Müəllim Əlavə Et">
        <div className="space-y-4">
          {[
            { key: 'full_name', label: 'Ad Soyad', placeholder: 'Əli Hüseynov' },
            { key: 'email', label: 'E-poçt', placeholder: 'muellim@email.com', type: 'email' },
            { key: 'phone', label: 'Telefon', placeholder: '+994501234567' },
            { key: 'subject', label: 'Fənn', placeholder: 'Riyaziyyat' },
            { key: 'password', label: 'Şifrə', placeholder: 'Pass@123', type: 'password' },
          ].map(({ key, label, placeholder, type = 'text' }) => (
            <div key={key}>
              <label className="block text-xs