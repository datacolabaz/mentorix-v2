import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Button from '../../components/common/Button'
import AdminReasonDialog from '../../components/admin/AdminReasonDialog'
import InstructorEngagement from '../instructor/Engagement'
import InstructorEngagementDetail from '../instructor/EngagementDetail'
import { clearAdminActivityScope, setAdminActivityScope } from '../../lib/adminActivityAccess'

/** /admin/instructors/:instructorId/activity[/material|assignment|exam/:id] — müəllim aktivliyinin admin baxışı (yalnız oxumaq). */
export default function AdminInstructorActivity() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { instructorId, '*': rest = '' } = useParams()
  const [detailType, detailId] = rest.split('/').filter(Boolean)
  const [instructorName] = useState(() => location.state?.instructorName || '')
  const [reason, setReason] = useState('')
  const [asking, setAsking] = useState(true)

  useEffect(() => {
    clearAdminActivityScope()
    setReason('')
    setAsking(true)
    return () => clearAdminActivityScope()
  }, [instructorId])

  const confirm = (why) => {
    if (setAdminActivityScope({ instructorId, reason: why })) {
      setReason(why)
      setAsking(false)
    }
  }

  const cancel = () => {
    if (reason) setAsking(false)
    else navigate('/admin/instructors')
  }

  const isDetail = ['material', 'assignment', 'exam'].includes(detailType) && detailId

  return (
    <div className="space-y-2">
      <div className="mx-4 sm:mx-6 mt-4 rounded-xl border border-amber-400/50 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            {t('adminActivity.bannerTitle', { name: instructorName || t('adminActivity.thisInstructor') })}
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300/90">
            {t('adminActivity.readOnlyNote')}
            {reason ? ` ${t('adminActivity.reasonShown', { reason })}` : ''}
          </p>
        </div>
        {reason ? (
          <Button size="sm" variant="secondary" onClick={() => setAsking(true)}>
            {t('adminActivity.changeReason')}
          </Button>
        ) : null}
        <Link to="/admin/instructors">
          <Button size="sm" variant="ghost">
            {t('adminActivity.exit')}
          </Button>
        </Link>
      </div>

      {reason ? (
        isDetail ? (
          <InstructorEngagementDetail key={`${detailType}:${detailId}:${reason}`} type={detailType} id={detailId} />
        ) : (
          <InstructorEngagement key={reason} />
        )
      ) : (
        <p className="px-6 py-10 text-center text-sm text-token-textMuted">{t('adminActivity.reasonRequired')}</p>
      )}

      <AdminReasonDialog
        open={asking}
        instructorName={instructorName}
        initialReason={reason}
        onConfirm={confirm}
        onCancel={cancel}
      />
    </div>
  )
}
