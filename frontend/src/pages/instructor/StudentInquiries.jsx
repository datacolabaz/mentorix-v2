import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'

function EmptyInboxIcon() {
  return (
    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5h16M4 7.5l1.4 10.2A2 2 0 0 0 7.38 19.5h9.24a2 2 0 0 0 1.98-1.8L20 7.5M9 11.5h6" />
      </svg>
    </div>
  )
}

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

  const viewed = Number(usage?.contacts_viewed_this_month) || 0
  const limit = Number(usage?.monthly_limit) || 0
  const usagePct = limit > 0 ? Math.min(100, (viewed / limit) * 100) : 0

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-display font-bold text-token-textMain">{t('studentInquiries.title')}</h1>
        <p className="text-sm text-token-textMuted mt-1 leading-relaxed">{t('studentInquiries.subtitle')}</p>
      </div>

      {usage && !usage.premium ? (
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-token-textMuted">
                {t('studentInquiries.usageTitle')}
              </p>
              <p className="mt-2 font-display font-extrabold text-3xl text-token-textMain tabular-nums">
                {viewed}/{limit}
              </p>
            </div>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <p className="text-sm text-token-textMuted leading-relaxed">
            {t('studentInquiries.usageLimit', { viewed, limit })}
          </p>
          {viewed === 0 ? (
            <p className="text-sm text-amber-400/90">{t('studentInquiries.usageEmpty')}</p>
          ) : null}
        </Card>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-5 sm:p-6 flex flex-col gap-4 h-full">
          <div className="space-y-2 flex-1">
            <h2 className="font-display font-bold text-base text-token-textMain">
              {t('studentInquiries.joinCardTitle')}
            </h2>
            <p className="text-sm text-token-textMuted leading-relaxed">
              {t('studentInquiries.joinCardDesc')}
            </p>
          </div>
          <Link to="/instructor/join-requests" className="block">
            <Button type="button" className="w-full justify-center">
              {t('studentInquiries.joinRequestsLink')}
            </Button>
          </Link>
        </Card>
        <Card className="p-5 sm:p-6 flex flex-col gap-4 h-full">
          <div className="space-y-2 flex-1">
            <h2 className="font-display font-bold text-base text-token-textMain">
              {t('studentInquiries.profileCardTitle')}
            </h2>
            <p className="text-sm text-token-textMuted leading-relaxed">
              {t('studentInquiries.profileCardDesc')}
            </p>
          </div>
          <Link to="/instructor/settings#discover-profile" className="block">
            <Button type="button" variant="secondary" className="w-full justify-center">
              {t('studentInquiries.settingsCta')}
            </Button>
          </Link>
        </Card>
      </div>

      <Card className="p-5 sm:p-6 space-y-4">
        <h2 className="font-display font-bold text-base text-token-textMain">
          {t('studentInquiries.recentTitle')}
        </h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : inquiries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--border-subtle)] px-5 py-10 sm:py-12 text-center">
            <EmptyInboxIcon />
            <p className="font-display font-bold text-lg text-token-textMain">
              {t('studentInquiries.emptyTitle')}
            </p>
            <p className="mt-2 text-sm text-token-textMuted leading-relaxed max-w-md mx-auto">
              {t('studentInquiries.emptyDesc')}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/instructor/join-requests">
                <Button type="button" variant="secondary" className="w-full sm:w-auto justify-center">
                  {t('studentInquiries.joinRequestsLink')}
                </Button>
              </Link>
              <Link to="/instructor/settings#discover-profile">
                <Button type="button" className="w-full sm:w-auto justify-center">
                  {t('studentInquiries.settingsCta')}
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {inquiries.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-[color:var(--border-subtle)] p-4 sm:p-5 space-y-2"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold text-token-textMain">{row.requester_name}</span>
                  <span className="text-xs text-token-textMuted">
                    {new Date(row.created_at).toLocaleString(dateLocale)}
                  </span>
                </div>
                {row.category_name ? (
                  <p className="text-xs text-primary">{row.category_name}</p>
                ) : null}
                {row.delivery_format ? (
                  <p className="text-xs text-token-textMuted">
                    {t('studentInquiries.formatLabel')}: {formatLabels[row.delivery_format] || row.delivery_format}
                    {row.student_level ? ` · ${row.student_level}` : ''}
                  </p>
                ) : null}
                {row.message ? <p className="text-sm text-token-textMuted">{row.message}</p> : null}
                <p className="text-sm font-mono text-token-textMain">
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
