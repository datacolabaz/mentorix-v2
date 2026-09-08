import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { useToast } from '../../components/common/Toast'
import PresentationUploadModal from '../../components/instructor/PresentationUploadModal'
import MaterialsStorageBanner from '../../components/instructor/MaterialsStorageBanner'
import useUiStore from '../../hooks/useUi'
import { formatNumericDateTime } from '../../lib/azMonths'

function formatUpdated(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return formatNumericDateTime(d) || '—'
}

export default function InstructorPresentations() {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const { theme } = useUiStore()
  const isDark = theme === 'dark'

  const [loading, setLoading] = useState(true)
  const [presentations, setPresentations] = useState([])
  const [quota, setQuota] = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/presentations')
      if (res?.success) {
        setPresentations(res.presentations || [])
        if (res.quota) setQuota(res.quota)
      }
    } catch (e) {
      toast(e?.message || t('presentations.toasts.loadFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast, t])

  useEffect(() => {
    void load()
  }, [load])

  const onUploadSuccess = (presentation, nextQuota, opts) => {
    if (nextQuota) setQuota(nextQuota)
    if (presentation?.id) {
      setPresentations((prev) => [presentation, ...prev.filter((p) => p.id !== presentation.id)])
      if (opts?.open) {
        setUploadOpen(false)
        navigate(`/instructor/presentations/${presentation.id}`)
        return
      }
    } else {
      void load()
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return
    setDeleteBusy(true)
    try {
      const res = await api.delete(`/presentations/${deleteTarget.id}`)
      setPresentations((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      if (res?.quota) setQuota(res.quota)
      toast(t('presentations.toasts.deleted'))
      setDeleteTarget(null)
    } catch (e) {
      toast(e?.message || t('presentations.toasts.deleteFailed'), 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => !deleteBusy && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={t('presentations.deleteTitle')}
        message={deleteTarget ? t('presentations.deleteConfirm', { title: deleteTarget.title }) : ''}
        confirmLabel={t('presentations.delete')}
        loading={deleteBusy}
        danger
      />

      <PresentationUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={onUploadSuccess}
        quota={quota}
        onUpgrade={() => navigate('/instructor/settings?tab=plans')}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">
            {t('presentations.title')}
          </h1>
          {quota ? (
            <p className="text-xs text-token-textMuted mt-1">
              {quota.labels?.used} / {quota.labels?.limit}
            </p>
          ) : null}
        </div>
        <Button onClick={() => setUploadOpen(true)} disabled={quota?.limit_reached}>
          {t('presentations.new')}
        </Button>
      </div>

      <MaterialsStorageBanner quota={quota} onUpgrade={() => navigate('/instructor/settings?tab=plans')} />

      {loading ? (
        <div className="text-center py-16 text-token-textMuted text-sm">{t('presentations.loading')}</div>
      ) : !presentations.length ? (
        <Card className="p-10 text-center border border-dashed border-[color:var(--border-subtle)]">
          <div className="text-4xl mb-3">📽️</div>
          <p className="font-display font-semibold text-token-textMain">{t('presentations.emptyTitle')}</p>
          <p className="text-sm text-token-textMuted mt-2 max-w-md mx-auto">{t('presentations.emptyBody')}</p>
          <div className="mt-5">
            <Button onClick={() => setUploadOpen(true)} disabled={quota?.limit_reached}>
              {t('presentations.new')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {presentations.map((p) => (
            <Card
              key={p.id}
              className={`flex flex-col h-full p-4 border border-[color:var(--border-subtle)] hover:border-primary/30 transition-colors ${
                isDark ? 'bg-[#121212]/80' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0">📽️</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-token-textMain line-clamp-2 break-words">{p.title}</h3>
                  <p className="text-[11px] text-token-textMuted mt-1">
                    {t('presentations.slides', { count: p.slide_count || 0 })}
                  </p>
                  <p className="text-[11px] text-token-textMuted mt-1">
                    {t('presentations.updated', { date: formatUpdated(p.updated_at || p.created_at) })}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-auto pt-4">
                <button
                  type="button"
                  onClick={() => navigate(`/instructor/presentations/${p.id}`)}
                  className="flex-1 min-w-[4rem] text-center text-xs font-semibold py-2 rounded-lg border border-primary/30 text-primary hover:bg-primary/10"
                >
                  {t('presentations.open')}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(p)}
                  className="px-3 py-2 rounded-lg text-xs text-red-300 border border-red-500/25 hover:bg-red-500/10"
                >
                  {t('presentations.delete')}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
