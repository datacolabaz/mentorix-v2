import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'

export default function StudentInquiries() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [inquiries, setInquiries] = useState([])
  const [usage, setUsage] = useState(null)

  const formatLabels = {
    online: t('studentInquiries.format.online'),
    teacher_place: t('studentInquiries.format.teacherPlace'),
    student_place: t('studentInquiries.format.studentPlace'),
  }

  const dateLocale = i18n.language?.startsWith('ru') ? 'ru-RU' : 'az-AZ'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/instructor/inquiries')
      if (res?.success) {
        setInquiries(Array.isArray(res.inquiries) ? res.inquiries : [])
        setUsage(res.usage || null)
      }
    } catch (e) {
      toast(e?.message || t('studentInquiries.loadFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast, t])

  useEffect(() => {
    void load()
  }, [load])

  const reveal = async (id) => {
    try {
      const res = await api.post(`/instructor/inquiries/${id}/reveal-contact`)
      if (res?.success) {
        toast(t('studentInquiries.phoneRevealed', { phone: res.phone }))
        await load()
      }
    } catch (e) {
      toast(e?.message || t('common.error'), 'error')
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-display font-bold text-white">{t('studentInquiries.title')}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {t('studentInquiries.subtitleBefore')}{' '}
          <Link to="/instructor/join-requests" className="text-primary hover:underline">
            {t('studentInquiries.joinRequestsLink')}
          </Link>
          .{' '}
          <Link to="/instructor/settings#discover-profile" className="text-primary hover:underline">
            {t('studentInquiries.searchProfileLink')}
          </Link>
        </p>
      </div>

      {usage && !usage.premium ? (
        <p className="text-xs text-amber-400/90">
          {t('studentInquiries.usageLimit', {
            viewed: usage.contacts_viewed_this_month,
            limit: usage.monthly_limit,
          })}
        </p>
      ) : null}

      <Card title={t('studentInquiries.recentTitle')}>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : inquiries.length === 0 ? (
          <div className="text-sm text-gray-400 space-y-3">
            <p>{t('studentInquiries.emptyMain')}</p>
            <p>
              {t('studentInquiries.emptyInviteBefore')}{' '}
              <Link to="/instructor/join-requests" className="text-primary hover:underline">
                {t('studentInquiries.joinRequestsLink')}
              </Link>
              .
            </p>
            <p className="text-xs text-gray-500">{t('studentInquiries.emptyHint')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {inquiries.map((row) => (
              <li key={row.id} className="rounded-xl border border-white/10 p-4 space-y-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold text-white">{row.requester_name}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(row.created_at).toLocaleString(dateLocale)}
                  </span>
                </div>
                {row.category_name ? (
                  <p className="text-xs text-primary">{row.category_name}</p>
                ) : null}
                {row.delivery_format ? (
                  <p className="text-xs text-gray-400">
                    {t('studentInquiries.formatLabel')}: {formatLabels[row.delivery_format] || row.delivery_format}
                    {row.student_level ? ` · ${row.student_level}` : ''}
                  </p>
                ) : null}
                {row.message ? <p className="text-sm text-gray-300">{row.message}</p> : null}
                <p className="text-sm font-mono text-gray-200">
                  {row.phone_visible ? row.requester_phone : row.phone_masked}
                </p>
                {row.can_reveal_contact ? (
                  <Button type="button" variant="secondary" className="text-xs" onClick={() => void reveal(row.id)}>
                    {t('studentInquiries.revealPhone')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
