import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import useAuthStore from '../../hooks/useAuth'
import useUiStore from '../../hooks/useUi'
import { instructorRoleAz } from '../../lib/instructorLabel'

export default function InstructorSettings() {
  const toast = useToast()
  const { user, updateUser } = useAuthStore()
  const theme = useUiStore((s) => s.theme)
  const [loading, setLoading] = useState(true)
  const [savingLabel, setSavingLabel] = useState(false)
  const [publicLabel, setPublicLabel] = useState('instructor')
  const [subjects, setSubjects] = useState([])
  const [newSubject, setNewSubject] = useState('')
  const [newGroupBySubject, setNewGroupBySubject] = useState({})
  const [busy, setBusy] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get('/instructor/teaching')
      setPublicLabel(d.public_label === 'trainer' ? 'trainer' : 'instructor')
      setSubjects(Array.isArray(d.subjects) ? d.subjects : [])
    } catch (e) {
      toast(e?.message || 'Yüklənmədi', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const saveLabel = async () => {
    setSavingLabel(true)
    try {
      await api.patch('/instructor/profile-label', { public_label: publicLabel })
      updateUser({ public_label: publicLabel })
      toast('Görünən ad saxlanıldı')
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setSavingLabel(false)
    }
  }

  const addSubject = async () => {
    const name = newSubject.trim()
    if (!name) {
      toast('Sahə adı daxil edin', 'error')
      return
    }
    setBusy((b) => ({ ...b, addSub: true }))
    try {
      await api.post('/instructor/teaching/subjects', { name })
      setNewSubject('')
      toast('Sahə əlavə olundu')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setBusy((b) => ({ ...b, addSub: false }))
    }
  }

  const removeSubject = async (id) => {
    if (!window.confirm('Bu sahəni və onun qruplarını silmək istəyirsiniz?')) return
    setBusy((b) => ({ ...b, [`dels-${id}`]: true }))
    try {
      await api.delete('/instructor/teaching/subjects/' + encodeURIComponent(id))
      toast('Silindi')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setBusy((b) => ({ ...b, [`dels-${id}`]: false }))
    }
  }

  const addGroup = async (subjectId) => {
    const raw = newGroupBySubject[subjectId] || ''
    const name = String(raw).trim()
    if (!name) {
      toast('Qrup adı daxil edin', 'error')
      return
    }
    setBusy((b) => ({ ...b, [`addg-${subjectId}`]: true }))
    try {
      await api.post('/instructor/teaching/groups', { subject_id: subjectId, name })
      setNewGroupBySubject((p) => ({ ...p, [subjectId]: '' }))
      toast('Qrup əlavə olundu')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setBusy((b) => ({ ...b, [`addg-${subjectId}`]: false }))
    }
  }

  const removeGroup = async (groupId) => {
    if (!window.confirm('Qrup silinsin?')) return
    setBusy((b) => ({ ...b, [`delg-${groupId}`]: true }))
    try {
      await api.delete('/instructor/teaching/groups/' + encodeURIComponent(groupId))
      toast('Silindi')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setBusy((b) => ({ ...b, [`delg-${groupId}`]: false }))
    }
  }

  const roleWord = instructorRoleAz(publicLabel)
  const inp =
    theme === 'dark'
      ? 'w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white placeholder:text-white/40 text-sm outline-none focus:border-blue-500'
      : 'w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15'

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-3xl mx-auto w-full space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain tracking-tight">Tənzimləmələr</h1>
        <p className="text-token-textMuted text-sm mt-1">
          İnterfeysdə və tələbə tərəfində sizin rolunuz{' '}
          <span className="text-primary/90 font-semibold">{roleWord}</span> kimi görünəcək.
        </p>
      </div>

      <Card className="p-5 border border-indigo-500/20 space-y-4">
        <h2 className="text-sm font-semibold text-indigo-200/90 uppercase tracking-wider">Görünən ad</h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          Dashboard və naviqasiyada, həmçinin tələbə ödəniş/tapşırıq ekranlarında göstərilən titul.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-200">
            <input
              type="radio"
              name="public_label"
              checked={publicLabel === 'instructor'}
              onChange={() => setPublicLabel('instructor')}
              className="accent-indigo-500"
            />
            Müəllim
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-200">
            <input
              type="radio"
              name="public_label"
              checked={publicLabel === 'trainer'}
              onChange={() => setPublicLabel('trainer')}
              className="accent-indigo-500"
            />
            Təlimçi
          </label>
        </div>
        <Button type="button" loading={savingLabel} onClick={() => void saveLabel()} className="w-full sm:w-auto justify-center">
          Saxla
        </Button>
      </Card>

      <Card className="p-5 border border-indigo-500/20 space-y-4">
        <h2 className="text-sm font-semibold text-indigo-200/90 uppercase tracking-wider">Tədris sahələri və qruplar</h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          Tələbə qeydiyyatında sahə və qrup seçiminə imkan verir; ödənişlər cədvəlində sahə adı görünür (hesabat üçün).
        </p>
        {loading ? (
          <p className="text-token-textMuted text-sm">Yüklənir…</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className={inp}
                placeholder="Məs: Java Programming"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                loading={busy.addSub}
                onClick={() => void addSubject()}
                className={
                  theme === 'light'
                    ? '!text-slate-900 !border-slate-200 bg-white hover:bg-slate-50'
                    : undefined
                }
              >
                Sahə əlavə et
              </Button>
            </div>
            <ul className="space-y-4">
              {!subjects.length ? (
                <li className="text-sm text-token-textMuted">
                  Hələ sahə yoxdur — əlavə edin və ya qeydiyyatda sahəni boş buraxın.
                </li>
              ) : null}
              {subjects.map((s) => (
                <li key={s.id} className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/60 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-white">{s.name}</div>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      loading={busy[`dels-${s.id}`]}
                      onClick={() => void removeSubject(s.id)}
                    >
                      Sil
                    </Button>
                  </div>
                  <div className="pl-2 border-l border-indigo-500/20 space-y-2">
                    {(s.groups || []).length === 0 ? (
                      <p className="text-xs text-token-textMuted">Qrup yoxdur</p>
                    ) : (
                      <ul className="space-y-1">
                        {(s.groups || []).map((g) => (
                          <li key={g.id} className="flex items-center justify-between gap-2 text-sm text-gray-300">
                            <span>{g.name}</span>
                            <button
                              type="button"
                              className="text-xs text-rose-300 hover:text-rose-200 disabled:opacity-40"
                              disabled={busy[`delg-${g.id}`]}
                              onClick={() => void removeGroup(g.id)}
                            >
                              Sil
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <input
                        className={inp + ' text-xs'}
                        placeholder="Yeni qrup adı"
                        value={newGroupBySubject[s.id] || ''}
                        onChange={(e) =>
                          setNewGroupBySubject((p) => ({
                            ...p,
                            [s.id]: e.target.value,
                          }))
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        loading={busy[`addg-${s.id}`]}
                        onClick={() => void addGroup(s.id)}
                        className={
                          theme === 'light'
                            ? '!text-slate-900 !border-slate-200 bg-white hover:bg-slate-50'
                            : undefined
                        }
                      >
                        Qrup əlavə et
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <p className="text-xs text-gray-600">
        Hesab: <span className="text-gray-400">{user?.full_name}</span>
      </p>
    </div>
  )
}
