import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import ContentGeneratorForm from '../../components/generation/ContentGeneratorForm'
import GenerationQuestionCard from '../../components/generation/GenerationQuestionCard'
import PublishDraftModal from '../../components/generation/PublishDraftModal'
import {
  generateQuestions,
  regenerateQuestionItem,
  updateDraftContent,
  publishDraft,
  discardDraft,
  newGenerationRequestId,
  generationErrorMessage,
} from '../../lib/generationApi'
import { normalizeGenerationLanguage } from '../../lib/generationLanguage'

/** Reduce a question object to the persisted shape the PATCH endpoint accepts. */
function toPersisted(q) {
  const payload = {
    id: q.id,
    text: String(q.text ?? '').trim(),
    correctAnswer: String(q.correctAnswer ?? '').trim(),
    difficulty: q.difficulty,
  }
  if (Array.isArray(q.options)) {
    const cleaned = q.options.map((o) => String(o ?? '').trim()).filter(Boolean)
    if (cleaned.length) payload.options = cleaned
  }
  if (q.explanation) payload.explanation = String(q.explanation).trim()
  return payload
}

const PHASES = { FORM: 'form', LOADING: 'loading', PREVIEW: 'preview' }

export default function AIQuestionGenerator() {
  const navigate = useNavigate()
  const toast = useToast()
  const { t, i18n } = useTranslation()

  const [phase, setPhase] = useState(PHASES.FORM)
  const [draftId, setDraftId] = useState(null)
  const [questions, setQuestions] = useState([])
  const [topic, setTopic] = useState('')
  const [lastFormValues, setLastFormValues] = useState(null)

  const [regeneratingId, setRegeneratingId] = useState(null)
  const [regeneratingAll, setRegeneratingAll] = useState(false)
  const [rowBusy, setRowBusy] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const [groups, setGroups] = useState([])
  const [groupsLoading, setGroupsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setGroupsLoading(true)
    api
      .get('/tasks/groups')
      .then((d) => {
        if (cancelled) return
        setGroups(Array.isArray(d?.groups) ? d.groups : [])
      })
      .catch(() => {
        if (!cancelled) setGroups([])
      })
      .finally(() => {
        if (!cancelled) setGroupsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleGenerate = useCallback(
    async (values) => {
      setPhase(PHASES.LOADING)
      setLastFormValues(values)
      setTopic(values.topic)
      try {
        const result = await generateQuestions({
          requestId: newGenerationRequestId(),
          topic: values.topic,
          level: values.level,
          questionCount: values.questionCount,
          format: values.format,
          difficulty: values.difficulty,
          language: normalizeGenerationLanguage(i18n.language),
        })
        const list = Array.isArray(result.questions) ? result.questions : []
        if (!result.draftId || list.length === 0) {
          throw new Error(t('generation.errors.generateFailed'))
        }
        setDraftId(result.draftId)
        setQuestions(list)
        setPhase(PHASES.PREVIEW)
      } catch (err) {
        toast(generationErrorMessage(err, t('generation.errors.generateFailed')), 'error')
        setPhase(PHASES.FORM)
      }
    },
    [toast, t, i18n.language],
  )

  const handleSaveQuestion = useCallback(
    async (updated) => {
      if (!draftId) return
      const nextQuestions = questions.map((q) => (q.id === updated.id ? { ...q, ...updated } : q))
      setRowBusy(true)
      try {
        const result = await updateDraftContent(draftId, nextQuestions.map(toPersisted))
        setQuestions(Array.isArray(result.questions) ? result.questions : nextQuestions)
        toast(t('generation.toasts.questionUpdated'), 'success')
      } catch (err) {
        toast(generationErrorMessage(err, t('generation.errors.saveFailed')), 'error')
        throw err
      } finally {
        setRowBusy(false)
      }
    },
    [draftId, questions, toast, t],
  )

  const handleDeleteQuestion = useCallback(
    async (questionId) => {
      if (!draftId) return
      if (questions.length <= 1) {
        toast(t('generation.errors.atLeastOne'), 'error')
        return
      }
      const remaining = questions.filter((q) => q.id !== questionId)
      setRowBusy(true)
      try {
        const result = await updateDraftContent(draftId, remaining.map(toPersisted))
        setQuestions(Array.isArray(result.questions) ? result.questions : remaining)
      } catch (err) {
        toast(generationErrorMessage(err, t('generation.errors.deleteFailed')), 'error')
      } finally {
        setRowBusy(false)
      }
    },
    [draftId, questions, toast, t],
  )

  const handleRegenerateQuestion = useCallback(
    async (questionId, instructions) => {
      if (!draftId) return
      setRegeneratingId(questionId)
      try {
        const result = await regenerateQuestionItem(draftId, questionId, instructions)
        const fresh = result.question
        if (fresh && fresh.id) {
          setQuestions((prev) => prev.map((q) => (q.id === questionId ? fresh : q)))
        }
      } catch (err) {
        toast(generationErrorMessage(err, t('generation.errors.regenerateFailed')), 'error')
      } finally {
        setRegeneratingId(null)
      }
    },
    [draftId, toast, t],
  )

  // Regenerates every question inside the SAME draft by replacing them one by one
  // through the existing per-item endpoint (no new draft is created).
  const handleRegenerateAll = useCallback(async () => {
    if (!draftId || questions.length === 0) return
    const ids = questions.map((q) => q.id)
    setRegeneratingAll(true)
    let failed = false
    try {
      for (const qid of ids) {
        setRegeneratingId(qid)
        try {
          const result = await regenerateQuestionItem(draftId, qid)
          const fresh = result.question
          if (fresh && fresh.id) {
            setQuestions((prev) => prev.map((q) => (q.id === qid ? fresh : q)))
          }
        } catch (err) {
          failed = true
          toast(generationErrorMessage(err, t('generation.errors.regenerateFailed')), 'error')
          break
        }
      }
      if (!failed) toast(t('generation.toasts.allRegenerated'), 'success')
    } finally {
      setRegeneratingId(null)
      setRegeneratingAll(false)
    }
  }, [draftId, questions, toast, t])

  const handlePublish = useCallback(
    async ({ groupId, title, dueDate }) => {
      if (!draftId) return
      setPublishing(true)
      try {
        // Sync any in-memory edits before publishing so the assignment matches the preview.
        await updateDraftContent(draftId, questions.map(toPersisted))
        const result = await publishDraft(draftId, { groupId, title, dueDate })
        setPublishOpen(false)
        toast(t('generation.toasts.published'), 'success')
        navigate('/instructor/tasks', {
          state: { highlightAssignmentId: result.assignmentId, from: 'ai-generator' },
        })
      } catch (err) {
        toast(generationErrorMessage(err, t('generation.errors.publishFailed')), 'error')
      } finally {
        setPublishing(false)
      }
    },
    [draftId, questions, navigate, toast, t],
  )

  const startOver = useCallback(async () => {
    const currentDraft = draftId
    setPhase(PHASES.FORM)
    setQuestions([])
    setDraftId(null)
    if (currentDraft) {
      // Best-effort cleanup; ignore failures.
      discardDraft(currentDraft).catch(() => {})
    }
  }, [draftId])

  const questionCount = questions.length
  const anyBusy = rowBusy || Boolean(regeneratingId) || regeneratingAll
  const publishDisabled = questionCount === 0 || anyBusy

  const headerSubtitle = useMemo(() => {
    if (phase === PHASES.PREVIEW && topic) return t('generation.page.subtitleTopic', { topic })
    return t('generation.page.subtitleDefault')
  }, [phase, topic, t])

  return (
    <div className="p-1 sm:p-2 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="font-display font-bold text-xl sm:text-2xl text-token-headingPrimary break-words flex items-center gap-2">
            <span aria-hidden>🤖</span>
            {t('generation.page.title')}
          </h1>
          <p className="text-sm text-token-textMuted mt-1 break-words">{headerSubtitle}</p>
        </div>
        {phase === PHASES.PREVIEW ? (
          <Button type="button" variant="ghost" size="sm" onClick={startOver} disabled={anyBusy}>
            {t('generation.page.startOver')}
          </Button>
        ) : null}
      </div>

      {phase === PHASES.FORM ? (
        <Card className="p-5 sm:p-6 max-w-2xl">
          <ContentGeneratorForm onSubmit={handleGenerate} />
        </Card>
      ) : null}

      {phase === PHASES.LOADING ? (
        <Card className="p-10 flex flex-col items-center justify-center text-center max-w-2xl">
          <div className="relative w-16 h-16 mb-5">
            <span className="absolute inset-0 rounded-full border-4 border-primary/20" />
            <span className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <span className="absolute inset-0 flex items-center justify-center text-2xl" aria-hidden>
              🤖
            </span>
          </div>
          <h2 className="font-display font-bold text-lg text-token-headingPrimary">{t('generation.page.loadingTitle')}</h2>
          <p className="text-sm text-token-textMuted mt-1.5 max-w-sm">{t('generation.page.loadingHint')}</p>
        </Card>
      ) : null}

      {phase === PHASES.PREVIEW ? (
        <div className="space-y-4 max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-sm text-token-textMuted">{t('generation.page.ready', { count: questionCount })}</div>
              <div className="text-xs text-violet-300/90">{t('generation.page.aiPreparedBy')}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleRegenerateAll}
                loading={regeneratingAll}
                disabled={anyBusy}
              >
                {t('generation.page.regenerateAll')}
              </Button>
              <Button type="button" size="sm" onClick={() => setPublishOpen(true)} disabled={publishDisabled}>
                {t('generation.page.publish')}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {questions.map((q, i) => (
              <GenerationQuestionCard
                key={q.id}
                question={q}
                index={i}
                busy={rowBusy || regeneratingAll}
                regenerating={regeneratingId === q.id}
                onSave={handleSaveQuestion}
                onDelete={() => handleDeleteQuestion(q.id)}
                onRegenerate={(instructions) => handleRegenerateQuestion(q.id, instructions)}
              />
            ))}
          </div>

          <div className="flex justify-end pt-2 pb-6">
            <Button type="button" onClick={() => setPublishOpen(true)} disabled={publishDisabled}>
              {t('generation.page.publish')}
            </Button>
          </div>
        </div>
      ) : null}

      <PublishDraftModal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        onPublish={handlePublish}
        groups={groups}
        groupsLoading={groupsLoading}
        defaultTitle={topic}
        publishing={publishing}
        questionCount={questionCount}
      />
    </div>
  )
}
