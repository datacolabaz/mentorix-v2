import { useEffect, useState } from 'react'
import api from '../../lib/api'
import ListSkeleton from '../../components/common/ListSkeleton'
import { useToast } from '../../components/common/Toast'
import { useOrgWorkspace } from '../../hooks/useOrgWorkspace'
import OrgPage, { OrgPanel, OrgEmpty, OrgTable } from '../../components/org/OrgPage'
import CourseBrandingForm from '../../components/course/CourseBrandingForm'
import PersonaSettingsCard from '../../components/onboarding/PersonaSettingsCard'

function fmtWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('az-AZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export function OrgMembers() {
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
      toast(err?.message || 'Rol dəyişmədi', 'error')
    }
  }

  return (
    <OrgPage title="Üzvlər" description="Təşkilat heyəti və rolları.">
      {loading ? (
        <ListSkeleton />
      ) : (
        <OrgPanel>
          <OrgTable
            columns={[
              { key: 'full_name', label: 'Ad' },
              { key: 'email', label: 'E-poçt', render: (r) => r.email || '—' },
              { key: 'role_name', label: 'Rol' },
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
                          {x.name_az}
                        </option>
                      ))}
                    </select>
                  ) : null,
              },
            ]}
            rows={members}
            empty={<OrgEmpty>Üzv yoxdur.</OrgEmpty>}
          />
        </OrgPanel>
      )}
    </OrgPage>
  )
}

export function OrgRoles() {
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  useEffect(() => {
    api.get('/course/roles').then((res) => {
      setRoles(res.roles || [])
      setPermissions(res.permissions || [])
    })
  }, [])
  return (
    <OrgPage
      title="Rollar və icazələr"
      description="RBAC kataloqu verilənlər bazasındadır. Yeni permission əlavə etmək üçün orgPermissions.js-ə açar yazılır."
    >
      {roles.map((role) => (
        <OrgPanel key={role.key} title={`${role.name_az} (${role.key})`} className="mb-3">
          <div className="flex flex-wrap gap-1.5">
            {(role.permissions || []).map((p) => (
              <span key={p} className="text-[11px] px-2 py-1 rounded-md border border-white/10 bg-white/[0.03] font-mono">
                {p}
              </span>
            ))}
          </div>
        </OrgPanel>
      ))}
      <OrgPanel title="Kataloq">
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
  return (
    <OrgPage title="Təşkilat profili" description="Təşkilat adı, loqo və filial.">
      <CourseBrandingForm />
    </OrgPage>
  )
}

export function OrgBranding() {
  return (
    <OrgPage title="Brendinq" description="Loqo və təşkilat adı.">
      <CourseBrandingForm />
    </OrgPage>
  )
}

export function OrgIntegrations() {
  return (
    <OrgPage title="İnteqrasiyalar" description="SSO, HRIS və digər B2B bağları.">
      <OrgPanel>
        <OrgEmpty>İnteqrasiya API-si hələ yoxdur. Bu səhifə gələcək bağlar üçün rezervdir.</OrgEmpty>
      </OrgPanel>
    </OrgPage>
  )
}

export function OrgNotifications() {
  const [rows, setRows] = useState([])
  useEffect(() => {
    api
      .get('/course/notifications')
      .then((res) => setRows(res.notifications || []))
      .catch(() => setRows([]))
  }, [])
  return (
    <OrgPage title="Bildirişlər" description="Təşkilat hesabına gələn daxili bildirişlər. Kütləvi SMS kampaniyası üçün ayrıca API yoxdur.">
      <OrgPanel>
        <OrgTable
          columns={[
            { key: 'title', label: 'Başlıq' },
            { key: 'body', label: 'Mətn', render: (r) => String(r.body || '').slice(0, 120) },
            { key: 'created_at', label: 'Vaxt', render: (r) => fmtWhen(r.created_at) },
          ]}
          rows={rows}
          empty={<OrgEmpty>Bildiriş yoxdur.</OrgEmpty>}
        />
      </OrgPanel>
    </OrgPage>
  )
}

export function OrgAudit() {
  const [rows, setRows] = useState([])
  useEffect(() => {
    api
      .get('/course/audit')
      .then((res) => setRows(res.events || []))
      .catch(() => setRows([]))
  }, [])
  return (
    <OrgPage title="Audit jurnalı" description="Actor, action, target, timestamp və metadata.">
      <OrgPanel>
        <OrgTable
          columns={[
            { key: 'created_at', label: 'Vaxt', render: (r) => fmtWhen(r.created_at) },
            { key: 'actor_name', label: 'Actor', render: (r) => r.actor_name || '—' },
            { key: 'action', label: 'Action' },
            { key: 'target_type', label: 'Target', render: (r) => `${r.target_type || '—'} ${r.target_id || ''}` },
            {
              key: 'metadata',
              label: 'Metadata',
              render: (r) => (
                <span className="font-mono text-[11px] text-token-textMuted">
                  {r.metadata ? JSON.stringify(r.metadata) : '—'}
                </span>
              ),
            },
          ]}
          rows={rows}
          empty={<OrgEmpty>Audit qeydi yoxdur.</OrgEmpty>}
        />
      </OrgPanel>
    </OrgPage>
  )
}

export function OrgSettings() {
  return (
    <OrgPage title="Tənzimləmələr" description="Təşkilat profili və hesab.">
      <PersonaSettingsCard />
      <CourseBrandingForm />
    </OrgPage>
  )
}
