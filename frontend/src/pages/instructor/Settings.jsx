import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import useAuthStore from '../../hooks/useAuth'
import { instructorRoleAz } from '../../lib/instructorLabel'
import useUiStore from '../../hooks/useUi'
import { SUBSCRIPTION_PLANS } from '../../constants/subscriptionPlans'

export default function InstructorSettings() {
  const toast = useToast()
  const { user, updateUser } = useAuthStore()
  const { theme } = useUiStore()
  const [loading, setLoading] = useState(true)
  const [planBusy, setPlanBusy] = useState(false)
  const [planErr, setPlanErr] = useState(null)
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

  const cardTitleCls = [
    'text-sm font-semibold uppercase tracking-wider',
    theme === 'dark' ? 'text-indigo-200/90' : 'text-token-textMain',
  ].join(' ')

  const cardTextCls = ['text-xs leading-relaxed', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')

  const inp = [
    'w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 border',
    theme === 'dark'
      ? 'bg-[#13112e] border-indigo-500/20 text-white placeholder:text-gray-500'
      : 'bg-token-surfaceMain border-[color:var(--border-subtle)] text-token-textMain placeholder:text-token-textMuted',
  ].join(' ')

  const secondaryBtnCls = [
    'whitespace-nowrap',
    theme === 'dark'
      ? 'border-white/15 text-white hover:bg-white/[0.06] hover:border-white/25'
      : '!border-slate-200 !text-slate-800 hover:!text-slate-900 hover:!border-slate-300 hover:bg-slate-500/10',
  ].join(' ')

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-3xl mx-auto w-full space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain tracking-tight">Tənzimləmələr</h1>
        <p className="text-token-textMuted text-sm mt-1">
          İnterfeysdə və tələbə tərəfində sizin rolunuz <span className="text-indigo-300">{roleWord}</span> kimi görünəcək.
        </p>
      </div>

      <Card className="p-5 border border-indigo-500/20 space-y-4">
        <h2 className={cardTitleCls}>Paketlər</h2>
        <p className={cardTextCls}>Basic, PRO və Business paketlərindən birini seçib ödəniş edə bilərsiniz.</p>
        {planErr ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-100 px-4 py-3 text-sm">
            {planErr}
          </div>
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SUBSCRIPTION_PLANS.map((p) => (
            <div
              key={p.id}
              className={[
                'rounded-2xl border p-4',
                p.highlight ? 'border-primary/40 bg-primary/5' : 'border-[color:var(--border-subtle)] bg-token-surfaceCard/40',
              ].join(' ')}
            >
              <div className="text-sm font-bold text-token-textMain">{p.title}</div>
              <div className="text-xs text-token-textMuted mt-1">{p.price}</div>
              <ul className="mt-3 space-y-1 text-xs text-token-textMain">
                {p.items.map((x) => (
                  <li key={x} className="flex items-center gap-2">
                    <span className="text-token-textMuted">•</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Button
                  className="w-full justify-center"
                  variant={p.highlight ? 'primary' : 'secondary'}
                  loading={planBusy}
                  disabled={planBusy}
                  onClick={async () => {
                    setPlanErr(null)
                    setPlanBusy(true)
                    try {
                      const r = await api.post('/billing/create-payment', { plan: p.id })
                      const url = r?.payment?.payment_url
                      if (!url) throw new Error('Ödəniş linki alınmadı')
                      window.location.href = url
                    } catch (e) {
                      setPlanErr(e?.message || 'Ödəniş yaradılmadı')
                    } finally {
                      setPlanBusy(false)
                    }
                  }}
                >
                  {p.highlight ? 'Upgrade to PRO' : 'Choose'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 border border-indigo-500/20 space-y-4">
        <h2 className={cardTitleCls}>Görünən ad</h2>
        <p className={cardTextCls}>
          Dashboard və naviqasiyada, həmçinin tələbə ödəniş/tapşırıq ekranlarında göstərilən titul.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className={['flex items-center gap-2 cursor-pointer text-sm', theme === 'dark' ? 'text-gray-200' : 'text-token-textMain'].join(' ')}>
            <input
              type="radio"
              name="public_label"
              checked={publicLabel === 'instructor'}
              onChange={() => setPublicLabel('instructor')}
              className="accent-indigo-500"
            />
            Müəllim
          </label>
          <label className={['flex items-center gap-2 cursor-pointer text-sm', theme === 'dark' ? 'text-gray-200' : 'text-token-textMain'].join(' ')}>
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
        <h2 className={cardTitleCls}>Tədris sahələri və qruplar</h2>
        <p className={cardTextCls}>
          Tələbə qeydiyyatında sahə və qrup seçiminə imkan verir; ödənişlər cədvəlində sahə adı görünür (hesabat üçün).
        </p>
        {loading ? (
          <p className={['text-sm', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>Yüklənir…</p>
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
                className={['w-full sm:w-auto justify-center', secondaryBtnCls].join(' ')}
              >
                Sahə əlavə et
              </Button>
            </div>
            <ul className="space-y-4">
              {!subjects.length ? (
                <li className={['text-sm', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>
                  Hələ sahə yoxdur — əlavə edin və ya qeydiyyatda sahəni boş buraxın.
                </li>
              ) : null}
              {subjects.map((s) => (
                <li
                  key={s.id}
                  className={[
                    'rounded-xl border p-4 space-y-3',
                    theme === 'dark'
                      ? 'border-indigo-500/15 bg-[#0f0c29]/60'
                      : 'border-[color:var(--border-subtle)] bg-token-surfaceMain/60',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={['font-medium', theme === 'dark' ? 'text-white' : 'text-token-textMain'].join(' ')}>
                      {s.name}
                    </div>
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
                  <div
                    className={[
                      'pl-2 border-l space-y-2',
                      theme === 'dark' ? 'border-indigo-500/20' : 'border-[color:var(--border-subtle)]',
                    ].join(' ')}
                  >
                    {(s.groups || []).length === 0 ? (
                      <p className={['text-xs', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>
                        Qrup yoxdur
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {(s.groups || []).map((g) => (
                          <li
                            key={g.id}
                            className={['flex items-center justify-between gap-2 text-sm', theme === 'dark' ? 'text-gray-300' : 'text-token-textMain'].join(' ')}
                          >
                            <span>{g.name}</span>
                            <button
                              type="button"
                              className={[
                                'text-xs disabled:opacity-40',
                                theme === 'dark' ? 'text-rose-300 hover:text-rose-200' : 'text-rose-700 hover:text-rose-800',
                              ].join(' ')}
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
                        className={secondaryBtnCls}
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

      <p className={['text-xs', theme === 'dark' ? 'text-gray-600' : 'text-token-textMuted'].join(' ')}>
        Hesab:{' '}
        <span className={theme === 'dark' ? 'text-gray-400' : 'text-token-textMain'}>{user?.full_name}</span>
      </p>
    </div>
  )
}

