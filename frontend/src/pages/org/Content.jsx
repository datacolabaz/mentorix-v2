import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import ListSkeleton from '../../components/common/ListSkeleton'
import OrgPage, { OrgPanel, OrgEmpty, OrgTable } from '../../components/org/OrgPage'
import { orgLifecycleLabel } from '../../lib/orgI18n'

export function OrgQuestionBank() {
  const { t } = useTranslation()
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true)
      const params = q ? `?q=${encodeURIComponent(q)}` : ''
      api
        .get(`/course/questions${params}`)
        .then((res) => setRows(res.questions || []))
        .catch(() => setRows([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [q])

  return (
    <OrgPage title={t('org.content.questionBank')} description={t('org.content.questionBankDesc')}>
      <input
        className="max-w-sm rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
        placeholder={t('org.common.search')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <OrgPanel>
        {loading ? (
          <ListSkeleton />
        ) : (
          <OrgTable
            columns={[
              { key: 'question_text', label: t('org.content.question'), render: (r) => String(r.question_text || '').slice(0, 140) },
              { key: 'question_type', label: t('org.content.type') },
              { key: 'subject', label: t('org.content.subject'), render: (r) => r.subject || '—' },
              { key: 'exam_title', label: t('org.content.sourceExam') },
              { key: 'owner_name', label: t('org.content.owner') },
            ]}
            rows={rows}
            empty={<OrgEmpty>{t('org.content.questionEmpty')}</OrgEmpty>}
          />
        )}
      </OrgPanel>
    </OrgPage>
  )
}

export function OrgTests() {
  const { t } = useTranslation()
  const [rows, setRows] = useState([])
  useEffect(() => {
    api
      .get('/course/exams')
      .then((res) => setRows(res.exams || []))
      .catch(() => setRows([]))
  }, [])
  return (
    <OrgPage title={t('org.content.tests')} description={t('org.content.testsDesc')}>
      <OrgPanel>
        <OrgTable
          columns={[
            { key: 'title', label: t('org.content.test') },
            { key: 'created_by', label: t('org.content.owner') },
            {
              key: 'lifecycle',
              label: t('org.exams.status'),
              render: (r) => orgLifecycleLabel(t, r.lifecycle),
            },
            { key: 'participants', label: t('org.content.assignment') },
          ]}
          rows={rows}
          empty={<OrgEmpty>{t('org.content.testsEmpty')}</OrgEmpty>}
        />
      </OrgPanel>
    </OrgPage>
  )
}

export function OrgTemplates() {
  const { t } = useTranslation()
  return (
    <OrgPage title={t('org.content.templates')} description={t('org.content.templatesDesc')}>
      <OrgPanel>
        <OrgEmpty>
          {t('org.content.templatesEmptyBefore')}{' '}
          <Link className="text-emerald-300 hover:underline" to="/org/exams">
            {t('org.content.templatesLink')}
          </Link>{' '}
          {t('org.content.templatesEmptyAfter')}
        </OrgEmpty>
      </OrgPanel>
    </OrgPage>
  )
}

export function OrgMaterials({ library = false }) {
  const { t } = useTranslation()
  const [rows, setRows] = useState([])
  useEffect(() => {
    api
      .get('/course/materials')
      .then((res) => setRows(res.materials || []))
      .catch(() => setRows([]))
  }, [])
  return (
    <OrgPage
      title={library ? t('org.content.library') : t('org.content.materials')}
      description={t('org.content.materialsDesc')}
    >
      <OrgPanel>
        <OrgTable
          columns={[
            { key: 'title', label: t('org.content.material') },
            { key: 'owner_name', label: t('org.content.owner') },
            { key: 'file_type', label: t('org.content.type') },
            { key: 'original_filename', label: t('org.content.file'), render: (r) => r.original_filename || '—' },
          ]}
          rows={rows}
          empty={<OrgEmpty>{t('org.content.materialsEmpty')}</OrgEmpty>}
        />
      </OrgPanel>
    </OrgPage>
  )
}
