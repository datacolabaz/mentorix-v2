import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../common/Modal'
import Button from '../common/Button'

const INPUT_CLS =
  'w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 disabled:opacity-50'
const LABEL_CLS = 'text-xs font-semibold text-token-textMuted block mb-1.5'

function defaultDueDate() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onPublish: (payload: { groupId: string, title: string, dueDate: string }) => Promise<void> | void,
 *   groups: Array<{ id: string, name: string, subject_name?: string }>,
 *   groupsLoading?: boolean,
 *   defaultTitle?: string,
 *   publishing?: boolean,
 *   questionCount: number,
 * }} props
 */
export default function PublishDraftModal({
  open,
  onClose,
  onPublish,
  groups,
  groupsLoading = false,
  defaultTitle = '',
  publishing = false,
  questionCount,
}) {
  const { t } = useTranslation()
  const [groupId, setGroupId] = useState('')
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(defaultDueDate)
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle || '')
      setDueDate(defaultDueDate())
      setGroupId((prev) => prev || (groups.length === 1 ? groups[0].id : ''))
      setAttempted(false)
    }
  }, [open, defaultTitle, groups])

  const errors = useMemo(() => {
    const e = {}
    if (!groupId) e.groupId = 'generation.publishModal.errGroup'
    if (!String(title).trim()) e.title = 'generation.publishModal.errTitle'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) e.dueDate = 'generation.publishModal.errDue'
    return e
  }, [groupId, title, dueDate])

  const valid = Object.keys(errors).length === 0

  const submit = () => {
    setAttempted(true)
    if (!valid) return
    void onPublish({ groupId, title: String(title).trim(), dueDate })
  }

  return (
    <Modal
      open={open}
      onClose={publishing ? () => {} : onClose}
      title={t('generation.publishModal.title')}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={publishing}>
            {t('generation.publishModal.cancel')}
          </Button>
          <Button type="button" onClick={submit} loading={publishing} disabled={!valid || publishing}>
            {t('generation.publishModal.publish')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-token-textMuted">
          {t('generation.publishModal.description', { count: questionCount })}
        </p>

        <div>
          <label className={LABEL_CLS}>{t('generation.publishModal.group')}</label>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            disabled={publishing || groupsLoading}
            className={`${INPUT_CLS} cursor-pointer [color-scheme:dark]`}
          >
            <option value="">
              {groupsLoading ? t('generation.publishModal.groupLoading') : t('generation.publishModal.groupSelect')}
            </option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.subject_name ? `${g.subject_name} — ${g.name}` : g.name}
              </option>
            ))}
          </select>
          {attempted && errors.groupId ? (
            <p className="text-[11px] text-red-400 mt-1">{t(errors.groupId)}</p>
          ) : null}
          {!groupsLoading && groups.length === 0 ? (
            <p className="text-[11px] text-amber-400 mt-1">{t('generation.publishModal.noGroups')}</p>
          ) : null}
        </div>

        <div>
          <label className={LABEL_CLS}>{t('generation.publishModal.taskTitle')}</label>
          <input
            type="text"
            value={title}
            maxLength={255}
            onChange={(e) => setTitle(e.target.value)}
            disabled={publishing}
            placeholder={t('generation.publishModal.taskTitlePh')}
            className={INPUT_CLS}
          />
          {attempted && errors.title ? (
            <p className="text-[11px] text-red-400 mt-1">{t(errors.title)}</p>
          ) : null}
        </div>

        <div>
          <label className={LABEL_CLS}>{t('generation.publishModal.dueDate')}</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={publishing}
            className={`${INPUT_CLS} block appearance-none [-webkit-appearance:none] leading-tight [color-scheme:dark]`}
          />
          {attempted && errors.dueDate ? (
            <p className="text-[11px] text-red-400 mt-1">{t(errors.dueDate)}</p>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
