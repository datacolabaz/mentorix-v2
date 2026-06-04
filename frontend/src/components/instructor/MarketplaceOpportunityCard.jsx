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
      : 'border-amber-400/50 bg-amber-50/80'

  return (
    <Card className={cardCls}>
      <div className="flex flex-col sm:flex-row gap-4 sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="font-display font-bold text-lg text-white">{opp.title || '🔥 Yeni tələbə fürsəti'}</h2>
          <p className="text-sm text-gray-200 leading-relaxed">{opp.body}</p>
          {data.map_feature ? (
            <p className="text-xs text-gray-500">Cari paketiniz: {data.map_feature}</p>
          ) : null}
        </div>
        <Link to={opp.cta_path || '/instructor/settings'} className="shrink-0">
          <Button type="button" className="w-full sm:w-auto justify-center whitespace-nowrap">
            {opp.cta_label || 'Paketi yüksəlt'}
          </Button>
        </Link>
      </div>
    </Card>
  )
}
