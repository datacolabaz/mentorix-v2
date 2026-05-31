import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'
import { buildWhatsAppInviteMessage, groupInvitationLink } from '../../lib/joinInvite'
import useUiStore from '../../hooks/useUi'
import { QRCodeCanvas } from 'qrcode.react'
import GroupPackageFields, {
  emptyGroupPackage,
  groupPackageFromApi,
  groupPackagePayload,
} from '../../components/instructor/GroupPackageFields'
import { formatAzn } from '../../lib/pricing'

function formatIncomeAzn(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return '0 ₼'
  return `${formatAzn(v)} ₼`
}

/** API/cədvəl kənar hallarında null qrup/sahə elementlərini süzür */
function normalizeTeachingSubjects(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((s) => s && s.id)
    .map((s) => ({
      ...s,
      name: String(s.name || '').trim() || '—',
      groups: (Array.isArray(s.groups) ? s.groups : [])
        .filter((g) => g && g.id)
        .map((g) => ({ ...g, name: String(g.name || '').trim() || '—' })),
    }))
}

export default function InstructorTeachingGroups() {
  const toast = useToast()
  const { theme } = useUiStore()
  const [loading, setLoading] = useState(true)
  const [subjects, setSubjects] = useState([])
  const [newSubject, setNewSubject] = useState('')
  const [newGroupBySubject, setNewGroupBySubject] = useState({})
  const [groupModal, setGroupModal] = useState(null)
  const [groupModalError, setGroupModalError] = useState('')
  const [groupPkg, setGroupPkg] = useState(emptyGroupPackage)
  const [busy, setBusy] = useState({})
  const [qrOpen, setQrOpen] = useState(false)
  const [qrGroup, setQrGroup] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get('/instructor/teaching')
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

  const openCreateGroup = (subjectId) => {
    const raw = newGroupBySubject[subjectId] || ''
    const name = String(raw).trim()
    if (!name) {
      toast('Qrup adı daxil edin', 'error')
      return
    }
    setGroupPkg(emptyGroupPackage())
    setGroupModalError('')
    setGroupModal({ mode: 'create', subjectId, name })
  }

  const openEditGroupPackage = (subjectId, group) => {
    setGroupPkg(groupPackageFromApi(group))
    setGroupModalError('')
    setGroupModal({ mode: 'edit', subjectId, group })
  }

  const saveGroupModal = async () => {
    if (!groupModal) return
    const lwd = groupPkg.default_lesson_weekdays || []
    if (!lwd.length) {
      const msg = 'Ən azı bir dərs günü seçin'
      setGroupModalError(msg)
      toast(msg, 'error')
      return
    }
    const fee = String(groupPkg.default_package_fee || '').trim()
    if (!fee) {
      const msg = 'Paket qiyməti (₼) tələb olunur'
      setGroupModalError(msg)
      toast(msg, 'error')
      return
    }
    setGroupModalError('')
    setBusy((b) => ({ ...b, groupModal: true }))
    try {
      const body = groupPackagePayload(groupPkg, groupModal.mode === 'create' ? groupModal.name : groupModal.group?.name)
      if (groupModal.mode === 'create') {
        await api.post('/instructor/teaching/groups', { subject_id: groupModal.subjectId, ...body })
        setNewGroupBySubject((p) => ({ ...p, [groupModal.subjectId]: '' }))
        toast('Qrup və paket tənzimləri yaradıldı')
      } else {
        await api.patch(`/instructor/teaching/groups/${encodeURIComponent(groupModal.group.id)}`, body)
        toast('Qrup paketi yeniləndi')
      }
      setGroupModal(null)
      await load()
    } catch (e) {
      const msg = e?.message || 'Xəta'
      setGroupModalError(msg)
      toast(msg, 'error')
    } finally {
      setBusy((b) => ({ ...b, groupModal: false }))
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
    <div className="p-4 sm:p-6 min-w-0 max-w-6xl mx-auto w-full space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain tracking-tight">
          Kurslar və qruplar
        </h1>
        <p className="text-token-textMuted text-sm mt-1 max-w-2xl">
          Tədris sahələri (məs. Python) və qruplar (məs. python1) yaradın, paket və dəvət linkini təyin edin. Tələbələr
          linklə qoşulur — təsdiq «Sorğular» bölməsindədir.
        </p>
      </div>

      <Card className="w-full p-5 border border-indigo-500/20 space-y-4">
        <h2 className={cardTitleCls}>Tədris sahələri və qruplar</h2>
        <p className={cardTextCls}>
          Qrup yaradarkən paket (8/12 dərs), qiymət və cədvəli bir dəfə təyin edin. Dəvət linki ilə qoşulan tələbə paketi
          görür və razılaşır; siz «Sorğular»da təsdiqləyirsiniz.
        </p>
        {loading ? (
          <p className={['text-sm', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>Yüklənir…</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className={inp}
                placeholder="Məs: Python"
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
                  Hələ sahə yoxdur — ilk sahənizi əlavə edin.
                </li>
              ) : null}
              {subjects.filter((s) => s?.id).map((s) => (
                <li
                  key={s.id}
                  className={[
                    'rounded-xl border p-4 space-y-3',
                    theme === 'dark'
                      ? 'border-indigo-500/15 bg-[#0f0c29]/60'
                      : 'border-[color:var(--border-subtle)] bg-token-surfaceMain/60',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className={['font-medium text-base', theme === 'dark' ? 'text-white' : 'text-token-textMain'].join(' ')}>
                        {s.name}
                      </div>
                      <div
                        className={[
                          'mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums',
                          theme === 'dark' ? 'text-gray-400' : 'text-token-textMuted',
                        ].join(' ')}
                      >
                        <span>
                          <span className="font-medium text-token-textMain">{Number(s.student_count) || 0}</span> tələbə
                        </span>
                        <span>
                          Bu ay gəlir:{' '}
                          <span className="font-medium text-emerald-400/95">
                            {formatIncomeAzn(s.income_this_month)}
                          </span>
                        </span>
                        <span>
                          {(s.groups || []).length} qrup
                        </span>
                      </div>
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
                        {(s.groups || []).filter((g) => g?.id).map((g) => (
                          <li
                            key={g.id}
                            className={[
                              'flex items-center justify-between gap-2 text-sm',
                              theme === 'dark' ? 'text-gray-300' : 'text-token-textMain',
                            ].join(' ')}
                          >
                            <div className="min-w-0">
                              <div className="truncate">{g.name}</div>
                              {g.join_code ? (
                                <div className="text-[11px] text-gray-500 mt-0.5 space-y-0.5">
                                  <div>
                                    {g.invite_ready ? (
                                      <span className="text-emerald-400/90 font-medium">Paket hazır · </span>
                                    ) : (
                                      <span className="text-amber-400/90 font-medium">Paket təyin edin · </span>
                                    )}
                                    {g.default_billing_type === '12_lessons' ? '12 dərs' : '8 dərs'}
                                    {g.default_package_fee != null ? ` · ${g.default_package_fee} ₼` : ''}
                                  </div>
                                  <div>
                                    Kod:{' '}
                                    <span
                                      className={
                                        theme === 'dark' ? 'text-gray-300 font-semibold' : 'text-token-textMain font-semibold'
                                      }
                                    >
                                      {g.join_code}
                                    </span>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                              <button
                                type="button"
                                className={['text-xs', theme === 'dark' ? 'text-indigo-300' : 'text-indigo-700'].join(' ')}
                                onClick={() => openEditGroupPackage(s.id, g)}
                              >
                                Paket
                              </button>
                              {g.join_code ? (
                                <>
                                  <button
                                    type="button"
                                    className={[
                                      'text-xs',
                                      theme === 'dark' ? 'text-primary hover:brightness-110' : 'text-primary hover:brightness-110',
                                    ].join(' ')}
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(String(g.join_code))
                                        toast('Kod kopyalandı', 'success')
                                      } catch {
                                        toast('Kopyalanmadı', 'error')
                                      }
                                    }}
                                  >
                                    Kod
                                  </button>
                                  <button
                                    type="button"
                                    className={[
                                      'text-xs',
                                      theme === 'dark' ? 'text-primary hover:brightness-110' : 'text-primary hover:brightness-110',
                                    ].join(' ')}
                                    onClick={async () => {
                                      const link = groupInvitationLink(g)
                                      try {
                                        await navigator.clipboard.writeText(link)
                                        toast('Link kopyalandı', 'success')
                                      } catch {
                                        toast('Link kopyalanmadı', 'error')
                                      }
                                    }}
                                  >
                                    Link
                                  </button>
                                  <button
                                    type="button"
                                    className={[
                                      'text-xs font-semibold',
                                      theme === 'dark' ? 'text-emerald-300 hover:brightness-110' : 'text-emerald-700 hover:brightness-110',
                                    ].join(' ')}
                                    title="WhatsApp üçün hazır mətn"
                                    onClick={async () => {
                                      const link = groupInvitationLink(g)
                                      const text = buildWhatsAppInviteMessage(link)
                                      try {
                                        await navigator.clipboard.writeText(text)
                                        toast('WhatsApp mətni kopyalandı', 'success')
                                      } catch {
                                        toast('Kopyalanmadı', 'error')
                                      }
                                    }}
                                  >
                                    Linki Kopyala
                                  </button>
                                  <button
                                    type="button"
                                    className={[
                                      'text-xs',
                                      theme === 'dark' ? 'text-primary hover:brightness-110' : 'text-primary hover:brightness-110',
                                    ].join(' ')}
                                    onClick={async () => {
                                      const link = `${window.location.origin}/join/${encodeURIComponent(String(g.join_code))}`
                                      try {
                                        if (navigator.share) {
                                          await navigator.share({ title: 'Mentorix invite', text: 'Qrupa qoşul', url: link })
                                          return
                                        }
                                      } catch {
                                        /* ignore */
                                      }
                                      try {
                                        await navigator.clipboard.writeText(link)
                                        toast('Link kopyalandı', 'success')
                                      } catch {
                                        toast('Link kopyalanmadı', 'error')
                                      }
                                    }}
                                  >
                                    Paylaş
                                  </button>
                                  <button
                                    type="button"
                                    className={[
                                      'text-xs',
                                      theme === 'dark' ? 'text-primary hover:brightness-110' : 'text-primary hover:brightness-110',
                                    ].join(' ')}
                                    onClick={() => {
                                      setQrGroup({ ...g, subjectName: s.name })
                                      setQrOpen(true)
                                    }}
                                  >
                                    QR
                                  </button>
                                </>
                              ) : null}
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
                            </div>
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
                        onClick={() => openCreateGroup(s.id)}
                        className={secondaryBtnCls}
                      >
                        Qrup + paket
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Modal
        open={Boolean(groupModal)}
        onClose={() => {
          setGroupModal(null)
          setGroupModalError('')
        }}
        title={groupModal?.mode === 'edit' ? 'Qrup paketi' : 'Yeni qrup və paket'}
        size="lg"
        zIndex={10050}
      >
        {groupModal ? (
          <div className="space-y-4">
            {groupModalError ? (
              <div
                className="rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm text-red-100"
                role="alert"
              >
                <strong className="font-semibold text-red-200">Xəta:</strong> {groupModalError}
              </div>
            ) : null}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Qrup adı</label>
              <input
                className={inp}
                value={groupModal.mode === 'create' ? groupModal.name : groupModal.group?.name || ''}
                readOnly={groupModal.mode === 'create'}
                onChange={
                  groupModal.mode === 'edit'
                    ? (e) =>
                        setGroupModal((m) => ({
                          ...m,
                          group: { ...m.group, name: e.target.value },
                        }))
                    : undefined
                }
              />
            </div>
            <GroupPackageFields value={groupPkg} onChange={setGroupPkg} />
            <div className="flex gap-2">
              <Button className="flex-1 justify-center" loading={busy.groupModal} onClick={() => void saveGroupModal()}>
                Yadda saxla
              </Button>
              <Button
                variant="secondary"
                className="flex-1 justify-center"
                onClick={() => {
                  setGroupModal(null)
                  setGroupModalError('')
                }}
              >
                Ləğv et
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="QR ilə qoşul" size="sm">
        <div className="space-y-4">
          <div className="text-sm text-gray-400 text-center">
            {qrGroup?.subjectName ? <div className="text-xs text-gray-500">{qrGroup.subjectName}</div> : null}
            <div className="text-white font-semibold">{qrGroup?.name}</div>
            {qrGroup?.join_code ? (
              <div className="mt-1">
                Join code: <span className="text-gray-200 font-semibold">{qrGroup.join_code}</span>
              </div>
            ) : null}
          </div>
          {qrGroup?.join_code ? (
            <div className="flex justify-center">
              <div className="bg-white rounded-2xl p-4">
                <QRCodeCanvas
                  value={`${window.location.origin}/join/${encodeURIComponent(String(qrGroup.join_code))}`}
                  size={220}
                  includeMargin
                />
              </div>
            </div>
          ) : null}
          {qrGroup?.join_code ? (
            <Button
              className="w-full justify-center"
              variant="secondary"
              onClick={async () => {
                const link = `${window.location.origin}/join/${encodeURIComponent(String(qrGroup.join_code))}`
                try {
                  await navigator.clipboard.writeText(link)
                  toast('Link kopyalandı', 'success')
                } catch {
                  toast('Link kopyalanmadı', 'error')
                }
              }}
            >
              Linki kopyala
            </Button>
          ) : null}
        </div>
      </Modal>
    </div>
  )
}
