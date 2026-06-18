import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import GroupSwitcher from '../../components/student/GroupSwitcher'
import { useStudentGroups } from '../../contexts/StudentGroupContext'
import { withEnrollmentQuery } from '../../lib/studentGroupQuery'
import { materialFileKind, materialFileOpenUrl } from '../../lib/materialFileUrl'
import { formatMaterialsBytes } from '../../lib/materialsPlanLimits'
import { studentEnrollmentDisplay } from '../../lib/participantGroupLabels'

function fileEmoji(material) {
  const kind = materialFileKind(material.file_type, material.file_url)
  if (kind === 'PDF') return '📄'
  if (kind === 'Word') return '📝'
  if (kind === 'Excel') return '📊'
  if (kind === 'PowerPoint') return '📽️'
  if (kind === 'Şəkil') return '🖼️'
  return '📎'
}

export default function StudentMaterials() {
  const { activeEnrollmentId, activeEnrollment } = useStudentGroups()
  const activeDisplay = studentEnrollmentDisplay(activeEnrollment)
  const [loading, setLoading] = useState(true)
  const [materials, setMaterials] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const path = withEnrollmentQuery('/materials/my', activeEnrollmentId)
      const res = await api.get(path)
      if (res?.success) setMaterials(res.materials || [])
    } catch {
      setMaterials([])
    } finally {
      setLoading(false)
    }
  }, [activeEnrollmentId])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = materials.reduce((acc, m) => {
    const key = m.group_name || activeDisplay.subject || 'Materiallar'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const sections = Object.entries(grouped)

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-token-textMain">Materiallar</h1>
          <p className="text-token-textMuted text-sm mt-1">
            Müəlliminizin paylaşdığı fayllar — yalnız qrupunuz üçün
          </p>
          {activeDisplay?.label ? (
            <p className="text-xs text-primary mt-2">{activeDisplay.label}</p>
          ) : null}
        </div>
        <GroupSwitcher />
      </div>

      {loading ? (
        <div className="text-center py-16 text-token-textMuted text-sm">Yüklənir…</div>
      ) : !sections.length ? (
        <Card className="p-8 text-center border border-dashed border-[color:var(--border-subtle)]">
          <div className="text-4xl mb-3">📁</div>
          <h2 className="font-display font-bold text-lg text-token-textMain">Material yoxdur</h2>
          <p className="text-sm text-token-textMuted mt-2">
            Müəlliminiz fayl yükləyəndə burada görünəcək.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {sections.map(([groupName, items]) => (
            <section key={groupName} className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-token-textMuted">{groupName}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((m) => (
                  <Card key={m.id} className="p-4 border border-[color:var(--border-subtle)]">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{fileEmoji(m)}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-token-textMain truncate">{m.title}</h3>
                        <p className="text-[11px] text-token-textMuted mt-1">
                          {materialFileKind(m.file_type, m.file_url)} · {formatMaterialsBytes(m.file_size)}
                        </p>
                        {m.assignment_title ? (
                          <p className="text-[11px] text-violet-400 mt-1 truncate">Tapşırıq: {m.assignment_title}</p>
                        ) : null}
                      </div>
                    </div>
                    <a
                      href={materialFileOpenUrl(m.file_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 block text-center text-xs font-semibold py-2 rounded-lg border border-violet-500/30 text-violet-300 hover:bg-violet-500/10"
                    >
                      Yüklə / Bax
                    </a>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
