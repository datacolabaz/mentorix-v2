import { useEffect, useState } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ListSkeleton from '../../components/common/ListSkeleton'
import { useToast } from '../../components/common/Toast'
import { WEEKDAYS } from './Schedule'

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
  monthly_fee: '',
  payment_start_date: '',
  teacher_schedule_id: '',
  parent_name: '',
  parent_phone: '',
}

function fmtSlotTime(t) {
  if (t == null) return ''
  const s = typeof t === 'string' ? t : String(t)
  return s.slice(0, 5)
}

function paymentDateHint(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  try {
    const d = parseISO(ymd)
    return isValid(d) ? format(d, 'dd.MM.yyyy') : null
  } catch {
    return null
  }
}

const inp =
  'w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500'

/** Komponent fayl səviyyəsində olmalıdır — parent içində təyin etsək hər render yeni tip olur və input fokusunu itirir */
function StudentFormFields({ data, setData, scheduleMeta, mode }) {
  const hint = paymentDateHint(data.payment_start_date)
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Aylıq ödəniş (₼)</label>
          <input
            className={inp}
            type="number"
            min={0}
            step={0.01}
            placeholder="0"
            value={data.monthly_fee}
            onChange={(e) => setData((p) => ({ ...p, monthly_fee: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Ödəniş başlanğıcı (gün.ay.il)
          </label>
          <input
            className={inp}
            type="date"
            value={data.payment_start_date}
            onChange={(e) => setData((p) => ({ ...p, payment_start_date: e.target.value }))}
          />
          {hint && (
            <p className="text-[11px] text-indigo-300/80 mt-1.5 tabular-nums">
              Seçilmiş tarix: <span className="text-white font-medium">{hint}</span>
            </p>
          )}
        </div>
      </div>
      {mode === 'add' && scheduleMeta && (
        <div className="rounded-xl border border-indigo-500/20 bg-[#0f0c29]/60 p-3 space-y-2">
          <p className="text-xs font-semibold text-indigo-200/90 uppercase tracking-wider">Dərs vaxtı</p>
          {scheduleMeta.loading && <p className="text-xs text-gray-500">Boş slotlar yüklənir…</p>}
          {!scheduleMeta.loading && scheduleMeta.requiresScheduleSlot && !scheduleMeta.availableSlots?.length && (
            <p className="text-xs text-amber-200/90">
              Boş slot yoxdur. Əvvəlcə «Cədvəlim» səhifəsində iş saatları yaradın.
            </p>
          )}
          {!scheduleMeta.loading && scheduleMeta.availableSlots?.length > 0 && (
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              <p className="text-[10px] text-gray-500">Yalnız boş slotlar göstərilir.</p>
              {WEEKDAYS.map((d) => {
                const list = scheduleMeta.availableSlots.filter((s) => s.day_of_week === d.v)
                if (!list.length) return null
                return (
                  <div key={d.v}>
                    <p className="text-[10px] font-semibold text-gray-500 mb-1.5">{d.full}</p>
                    <div className="flex flex-wrap gap-2">
                      {list.map((s) => (
                        <label
                          key={s.id}
                          className={`inline-flex items-center gap-2 cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                            data.teacher_schedule_id === s.id
                              ? 'border-indigo-400 bg-indigo-600/25 text-white'
                              : 'border-indigo-500/20 bg-[#13112e] text-gray-300 hover:border-indigo-500/40'
                          }`}
                        >
                          <input
                            type="radio"
                            name="teacher_schedule_slot"
                            className="accent-indigo-500"
                            checked={data.teacher_schedule_id === s.id}
                            onChange={() => setData((p) => ({ ...p, teacher_schedule_id: s.id }))}
                          />
                          <span className="font-mono tabular-nums">
                            {fmtSlotTime(s.start_time)}–{fmtSlotTime(s.end_time)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
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
  const [listError, setListError] = useState(null)
  const [enrollMeta, setEnrollMeta] = useState({
    loading: false,
    requiresScheduleSlot: false,
    availableSlots: [],
  })
  const toast = useToast()

  useEffect(() => {
    if (!addModal) return
    setEnrollMeta((m) => ({ ...m, loading: true }))
    api
      .get('/teacher-schedules/for-enrollment')
      .then((d) => {
        setEnrollMeta({
          loading: false,
          requiresScheduleSlot: !!d.requiresScheduleSlot,
          availableSlots: d.availableSlots || [],
        })
      })
      .catch(() => {
        setEnrollMeta({ loading: false, requiresScheduleSlot: false, availableSlots: [] })
      })
  }, [addModal])

  const load = async () => {
    setListError(null)
    setListLoading(true)
    try {
      const d = await api.get('/students')
      setStudents(d.students || [])
    } catch (err) {
      setListError(err?.message || 'Siyahı yüklənmədi')
      setStudents([])
    } finally {
      setListLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])

  const addStudent = async () => {
    if (!form.full_name || !form.phone) {
      toast('Ad ve telefon teleb olunur', 'error')
      return
    }
    if (enrollMeta.requiresScheduleSlot) {
      if (!enrollMeta.availableSlots?.length) {
        toast('Boş dərs slotu yoxdur — əvvəlcə «Cədvəlim»də slot yaradın', 'error')
        return
      }
      if (!form.teacher_schedule_id) {
        toast('Dərs vaxtı (boş slot) seçin', 'error')
        return
      }
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
        monthly_fee: form.monthly_fee,
        payment_start_date: form.payment_start_date || null,
        teacher_schedule_id: form.teacher_schedule_id || undefined,
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
      monthly_fee: s.monthly_fee != null && s.monthly_fee !== '' ? String(s.monthly_fee) : '',
      payment_start_date:
        s.payment_start_date != null && s.payment_start_date !== ''
          ? String(s.payment_start_date).slice(0, 10)
          : '',
      teacher_schedule_id: '',
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
        monthly_fee: editForm.monthly_fee,
        payment_start_date: editForm.payment_start_date,
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
        {!listLoading && listError && (
          <Card className="p-6 text-center border border-amber-500/30 bg-amber-500/5">
            <p className="text-amber-200/90 text-sm mb-3">{listError}</p>
            <p className="text-gray-500 text-xs mb-4">Şəbəkə və ya server gecikməsi ola bilər.</p>
            <Button type="button" variant="secondary" onClick={() => void load()}>
              Yenidən yüklə
            </Button>
          </Card>
        )}
        {!listLoading && !listError &&
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
        <StudentFormFields data={form} setData={setForm} scheduleMeta={enrollMeta} mode="add" />
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
        <StudentFormFields data={editForm} setData={setEditForm} mode="edit" />
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
