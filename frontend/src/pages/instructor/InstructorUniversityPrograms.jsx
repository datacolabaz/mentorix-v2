import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import Card from '../../components/common/Card'
import { useToast } from '../../components/common/Toast'
import { FIELD_GROUPS } from '../../lib/universityFieldCatalog'
import { MVP_COUNTRIES } from '../../lib/universitySearch'

const inputCls =
  'w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white [color-scheme:dark] focus:outline-none focus:border-primary/50'

const emptyForm = () => ({
  university_name: '',
  country: '',
  city: '',
  program_name: '',
  degree_level: 'MSc',
  field: '',
  language: 'English',
  tuition_fee: '',
  scholarship_available: true,
  duration_years: '2',
  deadline_dates: '',
  min_gpa: '',
  ielts: '',
  apply_link: '',
  mentor_notes: '',
})

export default function InstructorUniversityPrograms() {
  const toast = useToast()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [mine, setMine] = useState([])

  const loadMine = async () => {
    try {
      const res = await api.get('/instructor/university-programs/mine')
      if (res?.success) setMine(res.data || [])
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void loadMine()
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const deadlines = form.deadline_dates
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const res = await api.post('/instructor/university-programs', {
        university_name: form.university_name,
        country: form.country,
        city: form.city,
        program_name: form.program_name,
        degree_level: form.degree_level,
        field: form.field,
        language: form.language,
        tuition_fee: form.tuition_fee ? Number(form.tuition_fee) : null,
        scholarship_available: form.scholarship_available,
        duration_years: form.duration_years ? Number(form.duration_years) : null,
        deadline_dates: deadlines,
        requirements: {
          min_gpa: form.min_gpa ? Number(form.min_gpa) : null,
          min_language: form.ielts ? { ielts: Number(form.ielts) } : {},
          documents: ['Transcript', 'CV'],
        },
        apply_link: form.apply_link,
        mentor_notes: form.mentor_notes,
      })
      if (res?.success) {
        toast(res.message || 'Proqram göndərildi')
        setForm(emptyForm())
        void loadMine()
      }
    } catch (err) {
      toast(err?.message || 'Göndərilmədi', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-white">Universitet proqramı əlavə et</h1>
        <p className="text-sm text-gray-400 mt-1">
          Real qəbul etdiyiniz və ya məsləhət verdiyiniz proqramları daxil edin. Təsdiqdən sonra kartda mentor kimi görünəcəksiniz.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <form className="space-y-4" onSubmit={(e) => void submit(e)}>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block sm:col-span-2 space-y-1">
              <span className="text-xs text-gray-400">Universitet</span>
              <input className={inputCls} value={form.university_name} onChange={(e) => setForm((p) => ({ ...p, university_name: e.target.value }))} required />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-gray-400">Ölkə</span>
              <select className={inputCls} value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} required>
                <option value="">—</option>
                {MVP_COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-gray-400">Şəhər</span>
              <input className={inputCls} value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
            </label>
            <label className="block sm:col-span-2 space-y-1">
              <span className="text-xs text-gray-400">Proqram adı</span>
              <input className={inputCls} value={form.program_name} onChange={(e) => setForm((p) => ({ ...p, program_name: e.target.value }))} placeholder="Məs: Big Data Science" required />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-gray-400">Dərəcə</span>
              <select className={inputCls} value={form.degree_level} onChange={(e) => setForm((p) => ({ ...p, degree_level: e.target.value }))}>
                <option value="BSc">BSc</option>
                <option value="MSc">MSc</option>
                <option value="PhD">PhD</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-gray-400">İxtisas</span>
              <select className={inputCls} value={form.field} onChange={(e) => setForm((p) => ({ ...p, field: e.target.value }))} required>
                <option value="">—</option>
                {FIELD_GROUPS.map((g) => (
                  <optgroup key={g.id} label={g.label}>
                    {g.options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-gray-400">IELTS min</span>
              <input className={inputCls} type="number" step="0.5" value={form.ielts} onChange={(e) => setForm((p) => ({ ...p, ielts: e.target.value }))} placeholder="6.0" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-gray-400">Son tarix(lər)</span>
              <input className={inputCls} value={form.deadline_dates} onChange={(e) => setForm((p) => ({ ...p, deadline_dates: e.target.value }))} placeholder="2026-05-31" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-gray-400">Ödəniş (€/il)</span>
              <input className={inputCls} type="number" value={form.tuition_fee} onChange={(e) => setForm((p) => ({ ...p, tuition_fee: e.target.value }))} />
            </label>
            <label className="block sm:col-span-2 space-y-1">
              <span className="text-xs text-gray-400">Apply link</span>
              <input className={inputCls} value={form.apply_link} onChange={(e) => setForm((p) => ({ ...p, apply_link: e.target.value }))} placeholder="https://..." />
            </label>
          </div>
          <Button type="submit" loading={saving}>Göndər (admin təsdiqi)</Button>
        </form>
      </Card>

      {mine.length ? (
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Mənim proqramlarım</h2>
          <ul className="space-y-2 text-sm">
            {mine.map((p) => (
              <li key={p.id} className="rounded-xl border border-white/10 px-3 py-2 flex justify-between gap-2">
                <span className="text-gray-200">{p.uni_name} — {p.name}</span>
                <span className="text-xs text-gray-500">{p.review_status}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}
