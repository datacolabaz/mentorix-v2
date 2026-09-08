import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import ListSkeleton from '../../components/common/ListSkeleton'
import { useToast } from '../../components/common/Toast'
import { useOrgWorkspace } from '../../hooks/useOrgWorkspace'
import OrgPage, { OrgPanel, OrgEmpty, OrgTable } from '../../components/org/OrgPage'
import CourseBrandingForm from '../../components/course/CourseBrandingForm'
import PersonaSettingsCard from '../../components/onboarding/PersonaSettingsCard'
import { formatOrgDateTime, orgAuditAction, orgRoleName } from '../../lib/orgI18n'

export function OrgMembers() {
  const { t } = useTranslation()
  const toast = useToast()
  const { can } = useOrgWorkspace()
  const [members, setMembers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.get('/course/members'), can('roles.manage') ? api.get('/course/roles') : Promise.resolve({ roles: [] })])
      .then(([m, r]) => {
        setMembers(m.members || [])
        setRoles(r.roles || [])
      })
      .finally(() => setLoading(false))
  }, [can])

  async function changeRole(userId, roleKey) {
    try {
      const res = await api.patch(`/course/members/${userId}/role`, { role_key: roleKey })
      setMembers(res.members || [])
    } catch (err) {
      toast(err?.message || t('org.members.roleFailed'), 'error')
    }
  }

  return (
    <OrgPage title={t('org.members.title')} description={t('org.members.desc')}>
      {loading ? (
        <ListSkeleton />
      ) : (
        <OrgPanel>
          <OrgTable
            columns={[
              { key: 'full_name', label: t('org.members.name') },
              { key: 'email', label: t('org.members.email'), render: (r) => r.email || '—' },
              {
                key: 'role_name',
                label: t('org.members.role'),
                render: (r) => orgRoleName(t, r.role_key, r.role_name),
              },
              {
                key: 'role_key',
                label: '',
                render: (r) =>
                  can('roles.manage') && !r.is_owner ? (
                    <select
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs"
                      value={r.role_key}
                      onChange={(e) => changeRole(r.id, e.target.value)}
                    >
                      {roles.filter((x) => x.key !== 'owner').map((x) => (
                        <option key={x.key} value={x.key}>
                          {orgRoleName(t, x.key, x.name_az)}
                        </option>
                      ))}
                    </select>
                  ) : null,
              },
            ]}
            rows={members}
            empty={<OrgEmpty>{t('org.members.empty')}</OrgEmpty>}
          />
        </OrgPanel>
      )}
    </OrgPage>
  )
}

export function OrgRoles() {
  const { t } = useTranslation()
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  useEffect(() => {
    api.get('/course/roles').then((res) => {
      setRoles(res.roles || [])
      setPermissions(res.permissions || [])
    })
  }, [])
  return (
    <OrgPage title={t('org.roles.title')} description={t('org.roles.desc')}>
      {roles.map((role) => (
        <OrgPanel key={role.key} title={`${orgRoleName(t, role.key, role.name_az)} (${role.key})`} className="mb-3">
          <div className="flex flex-wrap gap-1.5">
            {(role.permissions || []).map((p) => (
              <span key={p} className="text-[11px] px-2 py-1 rounded-md border border-white/10 bg-white/[0.03] font-mono">
                {p}
              </span>
            ))}
          </div>
        </OrgPanel>
      ))}
      <OrgPanel title={t('org.roles.catalog')}>
        <div className="flex flex-wrap gap-1.5">
          {permissions.map((p) => (
            <span key={p.key} className="text-[11px] px-2 py-1 rounded-md border border-emerald-500/20 text-emerald-200 font-mono">
              {p.key}
            </span>
          ))}
        </div>
      </OrgPanel>
    </OrgPage>
  )
}

export function OrgProfile() {
  const { t } = useTranslation()
  return (
    <OrgPage title={t('org.profile.title')} description={t('org.profile.desc')}>
      <CourseBrandingForm />
    </OrgPage>
  )
}

export function OrgBranding() {
  const { t } = useTranslation()
  return (
    <OrgPage title={t('org.branding.title')} description={t('org.branding.desc')}>
      <CourseBrandingForm />
    </OrgPage>
  )
}

export function OrgIntegrations() {
  const { t } = useTranslation()
  return (
    <OrgPage title={t('org.integrations.title')} description={t('org.integrations.desc')}>
      <OrgPanel>
        <OrgEmpty>{t('org.integrations.empty')}</OrgEmpty>
      </OrgPanel>
    </OrgPage>
  )
}

export function OrgNotifications() {
  const { t, i18n } = useTranslation()
  const [rows, setRows] = useState([])
  useEffect(() => {
    api
      .get('/course/notifications')
      .then((res) => setRows(res.notifications || []))
      .catch(() => setRows([]))
  }, [])
  return (
    <OrgPage title={t('org.notifications.title')} description={t('org.notifications.desc')}>
      <OrgPanel>
        <OrgTable
          columns={[
            { key: 'title', label: t('org.notifications.heading') },
            { key: 'body', label: t('org.notifications.body'), render: (r) => String(r.body || '').slice(0, 120) },
            {
              key: 'created_at',
              label: t('org.notifications.time'),
              render: (r) => formatOrgDateTime(r.created_at, i18n.language),
            },
          ]}
          rows={rows}
          empty={<OrgEmpty>{t('org.notifications.empty')}</OrgEmpty>}
        />
      </OrgPanel>
    </OrgPage>
  )
}

export function OrgAudit() {
  const { t, i18n } = useTranslation()
  const [rows, setRows] = useState([])
  useEffect(() => {
    api
      .get('/course/audit')
      .then((res) => setRows(res.events || []))
      .catch(() => setRows([]))
  }, [])
  return (
    <OrgPage title={t('org.audit.title')} description={t('org.audit.desc')}>
      <OrgPanel>
        <OrgTable
          columns={[
            {
              key: 'created_at',
              label: t('org.audit.time'),
              render: (r) => formatOrgDateTime(r.created_at, i18n.language),
            },
            { key: 'actor_name', label: t('org.audit.actor'), render: (r) => r.actor_name || '—' },
            { key: 'action', label: t('org.audit.action'), render: (r) => orgAuditAction(t, r.action) },
            {
              key: 'target_type',
              label: t('org.audit.target'),
              render: (r) => `${r.target_type || '—'} ${r.target_id || ''}`,
            },
            {
              key: 'metadata',
              label: t('org.audit.metadata'),
              render: (r) => (
                <span className="font-mono text-[11px] text-token-textMuted">
                  {r.metadata ? JSON.stringify(r.metadata) : '—'}
                </span>
              ),
            },
          ]}
          rows={rows}
          empty={<OrgEmpty>{t('org.audit.empty')}</OrgEmpty>}
        />
      </OrgPanel>
    </OrgPage>
  )
}

export function OrgSettings() {
  const { t } = useTranslation()
  return (
    <OrgPage title={t('org.settings.title')} description={t('org.settings.desc')}>
      <PersonaSettingsCard />
      <CourseBrandingForm />
    </OrgPage>
  )
}
