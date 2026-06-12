import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../common/Card'
import Button from '../common/Button'

/**
 * SADƏ/PRO müəllimlər üçün: ictimai axtarışda fürsət bildirişi kartı.
 */
export default function MarketplaceOpportunityCard({ theme = 'dark' }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get('/instructor/marketplace-opportunity')
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return null
  if (!data?.eligible || !data?.opportunity) return null

  const opp = data.opportunity
  const cardCls =
    theme === 'dark'
      ? 'border-amber-500/35 bg-gradient-to-br from-amber-500/15 via-[#121212] to-violet-500/10'
      : 'border-amber-500/40 bg-amber-50 shadow-sm'

  const titleCls = theme === 'dark' ? 'text-white' : 'text-slate-900'
  const bodyCls = theme === 'dark' ? 'text-gray-200' : 'text-slate-700'
  const metaCls = theme === 'dark' ? 'text-gray-400' : 'text-slate-600'

  return (
    <Card className={`${cardCls} p-4 sm:p-5 min-w-0 w-full max-w-full overflow-hidden`}>
      <div className="flex flex-col gap-4 min-w-0 w-full">
        <div className="min-w-0 w-full space-y-2">
          <h2 className={`font-display font-bold text-base sm:text-lg leading-snug break-words ${titleCls}`}>
            {opp.title || '🔥 Yeni tələbə fürsəti'}
          </h2>
          <p className={`text-sm leading-relaxed break-words ${bodyCls}`}>{opp.body}</p>
          {data.map_feature ? (
            <p className={`text-xs ${metaCls}`}>Cari paketiniz: {data.map_feature}</p>
          ) : null}
        </div>
        <Link to={opp.cta_path || '/instructor/settings'} className="block w-full min-w-0">
          <Button type="button" className="w-full justify-center py-3 min-h-[44px]">
            {opp.cta_label || 'Paketi yüksəlt'}
          </Button>
        </Link>
      </div>
    </Card>
  )
}
