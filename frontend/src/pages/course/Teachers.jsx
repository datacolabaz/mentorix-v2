import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ListSkeleton from '../../components/common/ListSkeleton'
import PhoneInput from '../../components/auth/PhoneInput'
import { useToast } from '../../components/common/Toast'

export default function CourseTeachers() {
  const toast = useToast()
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    return api
      .get('/course/teachers')
      .then((res) => {
        setTeachers(Array.isArray(res.teachers) ? res.teachers : [])
      })
      .catch((err) => {
        setError(err?.message || 'Siyahı yüklənmədi')
        setTeachers([])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addTeacher(e) {
    e.preventDefault()
    const digits = String(phone || '').replace(/\D/g, '')
    if (digits.length < 9) {
      toast('Telefon nömrəsini düzgün daxil edin', 'error')
      return
    }
    setBusy(true)
    try {
      await api.post('/course/teachers', { phone: digits })
      toast('Müəllim kurs heyətinə əlavə edildi')
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
    <div className="p-4 sm:p-6 min-w-0 max-w-4xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">Müəllimlər</h1>
          <p className="text-token-textMuted text-sm mt-1 leading-relaxed max-w-xl">
            Platformada <strong className="text-white/90">müəllim kimi qeydiyyatdan keçmiş</strong> şəxsləri telefon
            nömrəsi ilə kurs heyətinə əlavə edin. Fərdi müəllim tələbələriniz avtomatik buraya düşmür.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Müəllim əlavə et</Button>
      </div>

      {error ? <p className="text-sm text-red-300/90">{error}</p> : null}

      {loading ? (
        <ListSkeleton />
      ) : teachers.length === 0 ? (
        <Card className="p-6 border border-white/10">
          <p className="text-sm text-token-textMuted">
            Hələ kurs müəllimi yoxdur. <strong className="text-white/80">+ Müəllim əlavə et</strong> ilə telefon
            nömrəsi üzrə işə götürün.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {teachers.map((t) => (
            <li key={t.id}>
              <Card className="p-4 border border-white/10 flex justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{t.full_name}</div>
                  {t.phone ? <div className="text-xs text-token-textMuted mt-0.5 tabular-nums">{t.phone}</div> : null}
                </div>
                <span className="text-xs text-token-textMuted tabular-nums shrink-0">
                  {t.course_students_count ?? 0} kurs tələbəsi
                </span>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => !busy && setModalOpen(false)} title="Müəllim əlavə et" size="md">
        <form onSubmit={(e) => void addTeacher(e)} className="space-y-5">
          <p className="text-sm text-token-textMuted leading-relaxed">
            Müəllimin platformada qeydiyyatdan keçdiyi telefon nömrəsini daxil edin. Sistem müəllim hesabını axtaracaq
            və kurs heyətinə əlavə edəcək.
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
