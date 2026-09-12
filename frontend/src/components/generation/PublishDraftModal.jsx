import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Modal from '../common/Modal'
import Button from '../common/Button'

/** Theme tokens via `.mx-field` — readable in light and dark mode. */
const INPUT_CLS = 'mx-field py-2.5'
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
 *   onPublish: (payload: { groupId: string | null, title: string, dueDate: string }) => Promise<void> | void,
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
      // Only auto-select when there is exactly one real teaching group.
      setGroupId((prev) => {
        if (prev && groups.some((g) => g.id === prev)) return prev
        return groups.length === 1 ? groups[0].id : ''
      })
      setAttempted(false)
    }
  }, [open, defaultTitle, groups])

  const errors = useMemo(() => {
    const e = {}
    if (!String(title).trim()) e.title = 'generation.publishModal.errTitle'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) e.dueDate = 'generation.publishModal.errDue'
    return e
  }, [title, dueDate])

  const valid = Object.keys(errors).length === 0
  const noGroups = !groupsLoading && groups.length === 0

  const submit = (forceLinkOnly = false) => {
    setAttempted(true)
    if (!valid) return
    void onPublish({
      groupId: forceLinkOnly ? null : groupId || null,
      title: String(title).trim(),
      dueDate,
    })
  }

  return (
    <Modal
      open={open}
      onClose={publishing ? () => {} : onClose}
      title={t('generation.publishModal.title')}
      size="md"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={publishing}>
            {t('generation.publishModal.cancel')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => submit(true)}
            disabled={publishing}
            title={t('generation.publishModal.shareLinkHint')}
          >
            {t('generation.publishModal.shareLink')}
          </Button>
          <Button type="button" onClick={() => submit(false)} loading={publishing} disabled={publishing}>
            {t('generation.publishModal.publish')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-token-textMuted">
          {t(
            groupId
              ? 'generation.publishModal.description'
              : 'generation.publishModal.descriptionLinkOnly',
            { count: questionCount },
          )}
        </p>

        <div>
          <label className={LABEL_CLS}>{t('generation.publishModal.group')}</label>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            disabled={publishing || groupsLoading || noGroups}
            className={`${INPUT_CLS} cursor-pointer`}
          >
            <option value="">
              {groupsLoading
                ? t('generation.publishModal.groupLoading')
                : noGroups
                  ? t('generation.publishModal.groupNone')
                  : t('generation.publishModal.groupOptional')}
            </option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.subject_name ? `${g.subject_name} — ${g.name}` : g.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-token-textMuted mt-1">
            {noGroups
              ? t('generation.publishModal.noGroupsLinkHint')
              : t('generation.publishModal.groupHint')}{' '}
            <Link
              to="/instructor/teaching-groups"
              className="text-primary font-medium underline underline-offset-2"
              onClick={onClose}
            >
              {t('generation.publishModal.createGroupOptional')}
            </Link>
          </p>
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
            className={`${INPUT_CLS} block appearance-none [-webkit-appearance:none] leading-tight`}
          />
          {attempted && errors.dueDate ? (
            <p className="text-[11px] text-red-400 mt-1">{t(errors.dueDate)}</p>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
