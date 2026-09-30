import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import MaterialEngagementCard from '../../components/engagement/MaterialEngagementCard'
import AssignmentEngagementCard from '../../components/engagement/AssignmentEngagementCard'
import { CardSkeleton } from '../../components/engagement/EngagementParts'
import { fetchEngagementList } from '../../components/engagement/engagementApi'
import { isAdminActivityMode } from '../../lib/adminActivityAccess'

const TABS = [
  { id: 'materials', label: 'Materiallar' },
  { id: 'assignments', label: 'Tapşırıqlar' },
]

const EMPTY = {
  materials: {
    title: 'Hələ material yoxdur',
    text: 'Kitabxanaya material yükləyib qrupa göndərəndə kimin baxdığını burada görəcəksiniz.',
    cta: { to: '/instructor/materials', label: 'Kitabxanaya keç' },
  },
  assignments: {
    title: 'Hələ tapşırıq yoxdur',
    text: 'Qrupa tapşırıq göndərəndə kimin təqdim etdiyini və kimin gecikdiyini burada görəcəksiniz.',
    cta: { to: '/instructor/tasks', label: 'Tapşırıq yarat' },
  },
}

export default function InstructorEngagement() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'assignments' ? 'assignments' : 'materials'
  const [data, setData] = useState({ materials: null, assignments: null })
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(async (which) => {
    setError('')
    setData((d) => ({ ...d, [which]: null }))
    try {
      const res = await fetchEngagementList(which)
      setData((d) => ({ ...d, [which]: Array.isArray(res?.[which]) ? res[which] : [] }))
    } catch (e) {
      setError(e?.message || 'Məlumat yüklənmədi')
    }
  }, [])

  useEffect(() => {
    if (data[tab] == null) void load(tab)
  }, [tab, data, load])

  const items = data[tab]
  const filtered = useMemo(() => {
    if (!items) return null
    const q = query.trim().toLocaleLowerCase('az')
    if (!q) return items
    return items.filter((it) =>
      [it.title, it.group_name, ...(it.group_names || [])].filter(Boolean).join(' ').toLocaleLowerCase('az').includes(q),
    )
  }, [items, query])

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-token-textMain">Aktivlik</h1>
          <p className="text-sm text-token-textMuted mt-1 max-w-2xl">
            Göndərdiyiniz material və tapşırıqlara kimin baxdığını, kimin təqdim etdiyini bir baxışda görün.
            Ətraflı siyahı üçün kartın status hissəsinin üzərinə gəlin və ya toxunun.
          </p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ad və ya qrup üzrə axtar…"
          aria-label="Axtar"
          className="w-full sm:w-64 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard px-3 py-2 text-sm"
        />
      </div>

      <div role="tablist" className="inline-flex rounded-xl border border-[color:var(--border-subtle)] p-1 gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams(t.id === 'materials' ? {} : { tab: t.id })}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-primary text-[#041018]' : 'text-token-textMuted hover:text-token-textMain'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <Card className="p-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => void load(tab)}>
            Yenidən cəhd et
          </Button>
        </Card>
      ) : filtered == null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Yüklənir">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : !items.length ? (
        <Card className="p-8 text-center border border-dashed border-[color:var(--border-subtle)]">
          <h2 className="font-display font-bold text-lg text-token-textMain">{EMPTY[tab].title}</h2>
          <p className="text-sm text-token-textMuted mt-2 max-w-md mx-auto">{EMPTY[tab].text}</p>
          {isAdminActivityMode() ? null : (
            <Link to={EMPTY[tab].cta.to} className="inline-block mt-4">
              <Button size="sm">{EMPTY[tab].cta.label}</Button>
            </Link>
          )}
        </Card>
      ) : !filtered.length ? (
        <p className="text-sm text-token-textMuted text-center py-10">«{query}» üzrə heç nə tapılmadı.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((it) =>
            tab === 'materials' ? (
              <MaterialEngagementCard key={it.id} material={it} />
            ) : (
              <AssignmentEngagementCard key={it.id} assignment={it} />
            ),
          )}
        </div>
      )}
    </div>
  )
}
