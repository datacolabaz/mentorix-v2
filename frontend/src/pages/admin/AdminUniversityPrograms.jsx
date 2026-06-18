import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import Card from '../../components/common/Card'
import { useToast } from '../../components/common/Toast'

export default function AdminUniversityPrograms() {
  const toast = useToast()
  const [pending, setPending] = useState([])
  const [targets, setTargets] = useState([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const [pRes, tRes] = await Promise.all([
        api.get('/admin/university-programs/pending'),
        api.get('/admin/university-scrape-targets'),
      ])
      if (pRes?.success) setPending(pRes.data || [])
      if (tRes?.success) setTargets(tRes.targets || [])
    } catch (e) {
      toast(e?.message || 'Yüklənmədi', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const review = async (id, status) => {
    try {
      await api.patch(`/admin/university-programs/${id}/review`, { status })
      toast(status === 'approved' ? 'Təsdiqləndi' : 'Rədd edildi')
      void refresh()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    }
  }

  const runScraper = async () => {
    setScraping(true)
    try {
      const res = await api.post('/admin/university-scrape/run', { limit: 3 })
      toast(`Skrayp: ${res?.succeeded || 0}/${res?.processed || 0} uğurlu`)
      void refresh()
    } catch (e) {
      toast(e?.message || 'Skrayp uğursuz', 'error')
    } finally {
      setScraping(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-white">Mentorix Apply — Admin</h1>
          <p className="text-sm text-gray-400 mt-1">AI skrayp və mentor proqram təsdiqi</p>
        </div>
        <Button onClick={() => void runScraper()} loading={scraping}>AI skrayp işə sal</Button>
      </div>

      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Skrayp hədəfləri ({targets.length})</h2>
        <ul className="text-xs text-gray-400 space-y-1 max-h-40 overflow-y-auto">
          {targets.map((t) => (
            <li key={t.id}>{t.country} · {t.university_name} — {t.last_error ? `xəta: ${t.last_error}` : 'OK'}</li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Təsdiq gözləyən proqramlar</h2>
        {loading ? <p className="text-sm text-gray-500">Yüklənir…</p> : null}
        {!loading && !pending.length ? <p className="text-sm text-gray-500">Pending yoxdur</p> : null}
        <ul className="space-y-3">
          {pending.map((p) => (
            <li key={p.id} className="rounded-xl border border-white/10 p-3 flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-white font-medium">{p.uni_name} — {p.name}</p>
                <p className="text-xs text-gray-400">{p.source_type} · {p.mentor_display_name || '—'} · {p.field}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" className="text-xs" onClick={() => void review(p.id, 'rejected')}>Rədd</Button>
                <Button className="text-xs" onClick={() => void review(p.id, 'approved')}>Təsdiq</Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
