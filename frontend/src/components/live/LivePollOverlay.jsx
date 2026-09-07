import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../common/Button'
import Modal from '../common/Modal'

export function LivePollComposer({ open, onClose, onSubmit }) {
  const { t } = useTranslation()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [kind, setKind] = useState('poll')
  const [correct, setCorrect] = useState(0)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const clean = options.map((text, i) => ({ id: `o${i + 1}`, text: text.trim() })).filter((o) => o.text)
    if (!question.trim() || clean.length < 2) return
    setBusy(true)
    try {
      await onSubmit({
        question: question.trim(),
        options: clean,
        kind,
        correct_option_id: kind === 'quiz' ? clean[Math.min(correct, clean.length - 1)]?.id : null,
      })
      setQuestion('')
      setOptions(['', ''])
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('live.presentation.askTitle')} size="md">
      <div className="space-y-3">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t('live.presentation.questionPh')}
          className="w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white"
        />
        {options.map((opt, i) => (
          <input
            key={i}
            value={opt}
            onChange={(e) => setOptions((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
            placeholder={t('live.presentation.optionPh', { n: i + 1 })}
            className="w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white"
          />
        ))}
        {options.length < 4 ? (
          <button type="button" className="text-xs text-primary" onClick={() => setOptions((p) => [...p, ''])}>
            + {t('live.presentation.addOption')}
          </button>
        ) : null}
        <div className="flex gap-3 text-xs text-gray-300">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={kind === 'poll'} onChange={() => setKind('poll')} />
            {t('live.presentation.poll')}
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={kind === 'quiz'} onChange={() => setKind('quiz')} />
            {t('live.presentation.quiz')}
          </label>
        </div>
        {kind === 'quiz' ? (
          <label className="block text-xs text-gray-400">
            {t('live.presentation.correct')}
            <select
              value={correct}
              onChange={(e) => setCorrect(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2 text-sm text-white"
            >
              {options.map((_, i) => (
                <option key={i} value={i}>
                  {t('live.presentation.optionPh', { n: i + 1 })}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('presentations.cancel')}
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            {t('live.presentation.sendQuestion')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function LivePollOverlay({ poll, isInstructor, onVote, onClose }) {
  const { t } = useTranslation()
  if (!poll) return null
  const closed = poll.status === 'closed'
  const voted = Boolean(poll.my_option_id)

  return (
    <div className="absolute left-3 right-3 bottom-3 z-30 rounded-2xl border border-white/15 bg-black/80 backdrop-blur px-3 py-3 max-w-lg">
      <p className="text-sm font-semibold text-white mb-2">{poll.question}</p>
      <div className="space-y-1.5">
        {(poll.options || []).map((opt) => {
          const pct = poll.total ? Math.round((opt.count / poll.total) * 100) : 0
          const mine = poll.my_option_id === opt.id
          const correct = closed && poll.correct_option_id && poll.correct_option_id === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              disabled={closed || voted || isInstructor}
              onClick={() => void onVote(opt.id)}
              className={[
                'relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm',
                mine ? 'border-primary/50 text-white' : 'border-white/10 text-gray-100',
                correct ? 'ring-1 ring-primary/60' : '',
              ].join(' ')}
            >
              {(isInstructor || voted || closed) && poll.total ? (
                <span className="absolute inset-y-0 left-0 bg-primary/20" style={{ width: `${pct}%` }} />
              ) : null}
              <span className="relative z-10 flex justify-between gap-2">
                <span>{opt.text}</span>
                {isInstructor || voted || closed ? <span className="text-[11px] text-white/70">{pct}%</span> : null}
              </span>
            </button>
          )
        })}
      </div>
      {isInstructor && !closed ? (
        <div className="mt-2 flex justify-end">
          <Button size="sm" variant="secondary" onClick={() => void onClose()}>
            {t('live.presentation.closePoll')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
