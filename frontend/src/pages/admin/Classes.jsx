import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'

const inputClass =
  'w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500'

export default function AdminClasses() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(false)

  const q = searchParams.get('q') || ''
  const instructor = searchParams.get('instructor') || ''

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (!value) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (instructor) params.set('instructor', instructor)
      const qs = params.toString()
      const d = await api.get(`/admin/classes${qs ? `?${qs}` : ''}`)
      setClasses(d.classes || [])
    } finally {
      setLoading(false)
    }
  }, [q, instructor])

  useEffect(() => {
    load()
  }, [load])

  const copyCode = (code) => {
    if (!code) return
    navigator.clipboard?.writeText(code)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl">Kurslar / Qruplar</h1>
        <p className="text-gray-400 text-sm mt-1">
          Yalnız real tədris qrupları — imtahan/tapşırıq iştirakçı qrupları ([System]) burada göstərilmir
        </p>
      </div>

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            className={inputClass}
            placeholder="Qrup adı..."
            value={q}
            onChange={(e) => setFilter('q', e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Müəllim adı..."
            value={instructor}
            onChange={(e) => setFilter('instructor', e.target.value)}
          />
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="mt-3"
          onClick={() => setSearchParams({}, { replace: true })}
        >
          Filtrləri təmizlə
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-indigo-500/20 text-gray-400 text-xs uppercase">
              {['Qrup', 'Müəllim', 'Sahə', 'Tələbə', 'Join kod', 'Yaradılıb', ''].map((h) => (
                <th key={h || 'copy'} className="py-3 px-4 text-left font-semibold tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.id} className="border-b border-indigo-500/10 hover:bg-indigo-500/5">
                <td className="py-3 px-4 font-semibold text-white">{c.name}</td>
                <td className="py-3 px-4 text-gray-300">
                  <div>{c.instructor_name}</div>
                  <div className="text-xs text-gray-500">{c.instructor_phone || ''}</div>
                </td>
                <td className="py-3 px-4 text-gray-300">{c.subject}</td>
                <td className="py-3 px-4 text-gray-300">{c.student_count ?? 0}</td>
                <td className="py-3 px-4">
                  <span className="font-mono text-blue-300 text-xs">{c.join_code || '—'}</span>
                </td>
                <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">
                  {c.created_at
                    ? new Date(c.created_at).toLocaleDateString('az-AZ')
                    : '—'}
                </td>
                <td className="py-3 px-4">
                  {c.join_code && (
                    <Button size="sm" variant="secondary" onClick={() => copyCode(c.join_code)}>
                      Kopyala
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="text-center py-8 text-gray-500">Yüklənir...</div>}
        {!loading && !classes.length && (
          <div className="text-center py-12 text-gray-500">Qrup tapılmadı</div>
        )}
      </Card>
    </div>
  )
}
