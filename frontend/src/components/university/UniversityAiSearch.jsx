import { useState } from 'react'
import Button from '../common/Button'
import api from '../../lib/api'

const inputCls =
  'w-full rounded-xl border border-violet-500/30 bg-[#141414] px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-400/60'

export default function UniversityAiSearch({ onResults, onError }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastSummary, setLastSummary] = useState([])

  const runSearch = async () => {
    const text = query.trim()
    if (!text) return
    setLoading(true)
    try {
      const res = await api.post('/programs/ai-search', { query: text, limit: 24 })
      setLastSummary(res.summary || [])
      onResults?.({
        filters: res.interpreted_filters || {},
        aiSummary: res.summary || [],
      })
    } catch (e) {
      onError?.(e?.response?.data?.message || e?.message || 'AI axtarış uğursuz oldu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-transparent p-4 sm:p-5 space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">AI uyğunluq axtarışı</p>
        <p className="text-sm text-gray-400">
          GPA, IELTS, büdcə və ixtisası bir cümlədə yazın — sistem uyğun proqramları tapır.
        </p>
      </div>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        rows={3}
        className={inputCls}
        placeholder={
          'Məs: GPA 3.2, IELTS 6.5, büdcəm 4000 avro. AI üzrə magistr istəyirəm. Polşa və Estoniya.'
        }
      />
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <p className="text-[11px] text-gray-500">Məs: QS top 500, təqaüd var, ingilis dili</p>
        <Button type="button" onClick={runSearch} disabled={loading || !query.trim()}>
          {loading ? 'Axtarılır…' : 'AI ilə tap'}
        </Button>
      </div>
      {lastSummary.length ? (
        <ul className="text-xs text-violet-200/90 space-y-1 list-disc list-inside">
          {lastSummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
