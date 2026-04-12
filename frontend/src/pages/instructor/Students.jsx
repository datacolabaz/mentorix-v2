import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ListSkeleton from '../../components/common/ListSkeleton'
import { useToast } from '../../components/common/Toast'

const BILLING_OPTS = [
  { value: '8_lessons', label: '8 Ders' },
  { value: '12_lessons', label: '12 Ders' },
  { value: 'monthly', label: 'Ayliq' },
]

const emptyForm = {
  full_name: '',
  email: '',
  phone: '',
  billing_type: '8_lessons',
  referral_notes: '',
  parent_name: '',
  parent_phone: '',
}

const inp =
  'w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500'

/** Komponent fayl səviyyəsində olmalıdır — parent içində təyin etsək hər render yeni tip olur və input fokusunu itirir */
function StudentFormFields({ data, setData }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ad Soyad *</label>
        <input
          className={inp}
          placeholder="Eli Huseynov"
          value={data.full_name}
          onChange={(e) => setData((p) => ({ ...p, full_name: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Telefon *</label>
          <input
            className={inp}
            placeholder="+994XXXXXXXXX"
            value={data.phone}
            onChange={(e) => setData((p) => ({ ...p, phone: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email</label>
          <input
            className={inp}
            placeholder="email@mail.com"
            value={data.email}
            onChange={(e) => setData((p) => ({ ...p, email: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Billing Novu</label>
        <select className={inp} value={data.billing_type} onChange={(e) => setData((p) => ({ ...p, billing_type: e.target.value }))}>
          {BILLING_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Menbe (ixtiyari)</label>
        <input
          className={inp}
          placeholder="Instagram, tovsiye..."
          value={data.referral_notes}
          onChange={(e) => setData((p) => ({ ...p, referral_notes: e.target.value }))}
        />
      </div>
      <div className="pt-2 border-t border-indigo-500/20">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Valideyn (ixtiyari)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ad Soyad</label>
            <input
              className={inp}
              placeholder="Valideyn adi"
              value={data.parent_name}
              onChange={(e) => setData((p) => ({ ...p, parent_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Telefon</label>
            <input
              className={inp}
              placeholder="+994XXXXXXXXX"
              value={data.parent_phone}
              onChange={(e) => setData((p) => ({ ...p, parent_phone: e.target.value }))}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InstructorStudents() {
  const [students, setStudents] = useState([])
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const toast = useToast()

  const load = async () => {
    try {
      const d = await api.get('/students')
      setStudents(d.students || [])
    } finally {
      setListLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const addStudent = async () => {
    if (!form.full_name || !form.phone) {
      toast('Ad ve telefon teleb olunur', 'error')
      return
    }
    setLoading(true)
    try {
      const reg = await api.post('/auth/register', {
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone,
        role: 'student',
        password: Math.random().toString(36).slice(-8),
      })
      const newUserId = reg.user?.id
      if (!newUserId) throw new Error('Qeydiyyat cavabı gözlənilən deyil')
      await api.post('/students/enroll', {
        student_id: newUserId,
        billing_type: form.billing_type,
        referral_notes: form.referral_notes,
        parent_name: form.parent_name,
        parent_phone: form.parent_phone,
      })
      toast('Telebe elave edildi!')
      setAddModal(false)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast(err.message || 'Xeta', 'error')
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (s) => {
    setEditId(s.enrollment_id)
    setEditForm({
      full_name: s.full_name || '',
      email: s.email || '',
      phone: s.phone || '',
      billing_type: s.billing_type || '8_lessons',
      referral_notes: s.referral_notes || '',
      parent_name: s.parent_name || '',
      parent_phone: s.parent_phone || '',
    })
    setEditModal(true)
  }

  const saveEdit = async () => {
    if (!editId) {
      toast('Qeydiyyat tapılmadı — səhifəni yeniləyin', 'error')
      return
    }
    if (!editForm.full_name?.trim() || !editForm.phone?.trim()) {
      toast('Ad və telefon mütləqdir', 'error')
      return
    }
    setLoading(true)
    try {
      await api.patch('/students/enrollment/' + encodeURIComponent(editId), {
        full_name: editForm.full_name,
        email: editForm.email,
        phone: editForm.phone,
        billing_type: editForm.billing_type,
        referral_notes: editForm.referral_notes,
        parent_name: editForm.parent_name,
        parent_phone: editForm.parent_phone,
      })
      toast('Melumatlari yenilendi!')
      setEditModal(false)
      load()
    } catch (err) {
      toast(err.message || 'Xeta', 'error')
    } finally {
      setLoading(false)
    }
  }

  const deleteStudent = async (enrollmentId, name) => {
    if (!window.confirm(name + ' silinsin?')) return
    try {
      await api.delete('/students/enrollment/' + enrollmentId)
      toast('Telebe silindi')
      load()
    } catch (err) {
      toast(err.message || 'Xeta', 'error')
    }
  }

  return (
    <div className="p-4 sm:p-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="font-display font-bold text-xl sm:text-2xl break-words">Tələbələrim</h1>
          <p className="text-gray-500 text-sm mt-1">
            {listLoading ? '…' : `${students.length} telebe`}
          </p>
        </div>
        <Button
          className="w-full sm:w-auto shrink-0 justify-center"
          onClick={() => {
            setForm(emptyForm)
            setAddModal(true)
          }}
        >
          + Telebe Elave Et
        </Button>
      </div>

      <div className="space-y-3">
        {listLoading && <ListSkeleton message="Tələbələr yüklənir…" />}
        {!listLoading &&
          students.map((s) => (
          <Card key={s.enrollment_id} className="p-4 min-w-0 overflow-hidden">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {s.full_name?.split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-white truncate">{s.full_name}</div>
                  <div className="text-xs text-gray-400 flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
                    {s.phone && <span className="break-all">{s.phone}</span>}
                    {s.email && <span className="break-all">{s.email}</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <div className="text-left sm:text-right">
                  <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-lg font-semibold inline-block">
                    {s.lesson_count || 0}/{BILLING_OPTS.find((o) => o.value === s.billing_type)?.label || s.billing_type}
                  </span>
                  {s.avg_score && <div className="text-xs text-gray-400 mt-1">Orta: {s.avg_score}%</div>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(s)}>
                    Redakte
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => deleteStudent(s.enrollment_id, s.full_name)}>
                    Sil
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
        {!listLoading && !listError && !students.length && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">Telebe yoxdur</p>
            <p className="text-sm">Yuxaridan telebe elave edin</p>
          </div>
        )}
      </div>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Yeni Telebe Elave Et">
        <StudentFormFields data={form} setData={setForm} />
        <div className="flex gap-3 mt-4">
          <Button onClick={addStudent} loading={loading} className="flex-1 justify-center">
            Elave Et
          </Button>
          <Button variant="secondary" onClick={() => setAddModal(false)} className="flex-1 justify-center">
            Legv et
          </Button>
        </div>
      </Modal>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Telebeyi Redakte Et">
        <StudentFormFields data={editForm} setData={setEditForm} />
        <div className="flex gap-3 mt-4">
          <Button onClick={saveEdit} loading={loading} className="flex-1 justify-center">
            Yadda Saxla
          </Button>
          <Button variant="secondary" onClick={() => setEditModal(false)} className="flex-1 justify-center">
            Legv et
          </Button>
        </div>
      </Modal>
    </div>
  )
}
