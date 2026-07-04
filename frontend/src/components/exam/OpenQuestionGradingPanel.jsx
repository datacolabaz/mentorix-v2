import { useState } from 'react'
import Button from '../common/Button'
import api from '../../lib/api'

function statusBadgeClass(label) {
  if (label === 'Düzgün' || label === 'Doğru' || label === 'Qismən düzgün') {
    return 'bg-emerald-500/20 text-emerald-300'
  }
  if (label === 'Səhv') return 'bg-red-500/15 text-red-300'
  if (label === 'AI tövsiyəsi') return 'bg-violet-500/20 text-violet-200'
  if (label === 'Cavabsız') return 'bg-amber-500/15 text-amber-200'
  return 'bg-gray-500/15 text-gray-400'
}

export default function OpenQuestionGradingPanel({
  row,
  examId,
  resultId,
  onUpdated,
}) {
  const og = row?.open_grading
  const maxPts = Number(row?.max_points) || 0
  const [editMode, setEditMode] = useState(false)
  const [editScore, setEditScore] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!og || row?.question_type !== 'open') return null

  const canAct = og.grading_status === 'ai_suggested' || og.grading_status === 'pending'
  const suggested = og.ai_suggested_score
  const showAi =
    og.grading_status === 'ai_suggested' &&
    suggested != null &&
    Number.isFinite(Number(suggested))

  const patchGrading = async (body) => {
    if (!examId || !resultId || !row.question_id) return
    setBusy(true)
    setError('')
    try {
      const d = await api.patch(
        `/exams/${encodeURIComponent(examId)}/results/${encodeURIComponent(resultId)}/open-grading/${encodeURIComponent(row.question_id)}`,
        body,
      )
      setEditMode(false)
      onUpdated?.(d)
    } catch (e) {
      setError(e?.message || 'Xəta baş verdi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-violet-500/25 bg-violet-500/5 p-3 space-y-2">
      {og.grading_status === 'teacher_confirmed' ? (
        <p className="text-xs text-emerald-300">
          Təsdiqlənmiş bal: <strong>{og.final_score}</strong> / {maxPts}
        </p>
      ) : null}

      {showAi ? (
        <p className="text-sm text-violet-100 leading-snug">
          <span className="text-violet-300 font-semibold">AI tövsiyəsi:</span>{' '}
          {Math.round(Number(suggested) * 100) / 100}/{maxPts}
          {og.ai_reasoning ? ` — "${og.ai_reasoning}"` : ''}
        </p>
      ) : null}

      {og.grading_status === 'pending' && og.ai_error ? (
        <p className="text-xs text-amber-300">AI müvəqqəti işləmədi — əl ilə qiymətləndirin.</p>
      ) : null}

      {og.grading_status === 'pending' && !og.ai_error ? (
        <p className="text-xs text-gray-400">AI qiymətləndirməsi gözlənilir…</p>
      ) : null}

      {canAct && showAi && !editMode ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void patchGrading({ action: 'accept' })}
          >
            ✅ Qəbul et
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setEditScore(String(suggested ?? ''))
              setEditMode(true)
            }}
          >
            ✏️ Dəyiş
          </Button>
        </div>
      ) : null}

      {canAct && (editMode || (og.grading_status === 'pending' && !showAi)) ? (
        <div className="flex flex-wrap items-end gap-2 pt-1">
          <label className="text-xs text-gray-400">
            Bal (0–{maxPts})
            <input
              type="number"
              min={0}
              max={maxPts}
              step="0.01"
              className="mt-1 block w-24 rounded-lg border border-[color:var(--border-subtle)] bg-token-surfaceMain px-2 py-1.5 text-sm text-white"
              value={editScore}
              onChange={(e) => setEditScore(e.target.value)}
            />
          </label>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void patchGrading({ action: 'set', final_score: Number(editScore) })}
          >
            Saxla
          </Button>
          {editMode ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditMode(false)}>
              Ləğv
            </Button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  )
}
