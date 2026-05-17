import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ListSkeleton from '../../components/common/ListSkeleton'
import PhoneInput from '../../components/auth/PhoneInput'
import { useToast } from '../../components/common/Toast'

export default function CourseStudents() {
  const toast = useToast()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    return api
      .get('/course/students')
      .then((res) => setStudents(Array.isArray(res.students) ? res.students : []))
      .catch((err) => {
        setError(err?.message || 'Yüklənmədi')
        setStudents([])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addStudent(e) {
    e.preventDefault()
    const digits = String(phone || '').replace(/\D/g, '')
    if (digits.length < 9) {
      toast('Telefon nömrəsini düzgün daxil edin', 'error')
      return
    }
    setBusy(true)
    try {
      await api.post('/course/students', { phone: digits })
      toast('Tələbə kursa əlavə edildi')
      setModalOpen(false)
      setPhone('')
      load()
    } catch (err) {
      toast(err?.message || 'Əlavə edilmədi', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">Tələbələr</h1>
          <p className="text-token-textMuted text-sm mt-1 max-w-xl leading-relaxed">
            Yalnız bu kursa əlavə etdiyiniz tələbələr. Fərdi müəllim panelinizdəki şagirdlər avtomatik burada
            görünmür.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Tələbə əlavə et</Button>
      </div>

      {error ? <p className="text-sm text-red-300/90">{error}</p> : null}

      {loading ? (
        <ListSkeleton />
      ) : students.length === 0 ? (
        <Card className="p-6 border border-white/10">
          <p className="text-sm text-token-textMuted">
            Hələ kurs tələbəsi yoxdur. Platformada qeydiyyatdan keçmiş tələbəni telefon ilə əlavə edin.
          </p>
        </Card>
      ) : (
        <Card className="border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase text-token-textMuted">
                  <th className="p-3 font-semibold">Ad</th>
                  <th className="p-3 font-semibold">Telefon</th>
                  <th className="p-3 font-semibold">Müəllim</th>
                  <th className="p-3 font-semibold">Qrup</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-3 text-white font-medium">{s.full_name}</td>
                    <td className="p-3 text-token-textMuted tabular-nums">{s.phone || '—'}</td>
                    <td className="p-3 text-token-textMuted">{s.instructor_name || '—'}</td>
                    <td className="p-3 text-token-textMuted">{s.group_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => !busy && setModalOpen(false)} title="Tələbə əlavə et" size="md">
        <form onSubmit={(e) => void addStudent(e)} className="space-y-5">
          <p className="text-sm text-token-textMuted leading-relaxed">
            Tələbənin platformada qeydiyyatdan keçdiyi telefon nömrəsini daxil edin.
          </p>
          <label className="block space-y-2">
            <span className="text-xs font-medium uppercase tracking-wider text-token-textMuted">Telefon nömrəsi</span>
            <PhoneInput value={phone} onChange={setPhone} required autoFocus />
          </label>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setModalOpen(false)}>
              Ləğv
            </Button>
            <Button type="submit" loading={busy}>
              Axtar və əlavə et
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
