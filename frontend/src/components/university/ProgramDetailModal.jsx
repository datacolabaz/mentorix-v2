import Modal from '../common/Modal'
import Button from '../common/Button'
import { formatDeadline, formatTuition } from '../../lib/universitySearch'

function RequirementsBlock({ requirements }) {
  if (!requirements || typeof requirements !== 'object') {
    return <p className="text-sm text-gray-400">Tələblər göstərilməyib.</p>
  }

  const docs = Array.isArray(requirements.documents) ? requirements.documents : []
  const lang = requirements.min_language || {}

  return (
    <div className="space-y-3 text-sm">
      {requirements.min_gpa != null ? (
        <p>
          <span className="text-gray-500">Min GPA:</span>{' '}
          <span className="text-white">{requirements.min_gpa}</span>
        </p>
      ) : null}
      {Object.keys(lang).length ? (
        <p>
          <span className="text-gray-500">Dil:</span>{' '}
          <span className="text-white">
            {Object.entries(lang)
              .map(([k, v]) => `${k.toUpperCase()} ${v}`)
              .join(', ')}
          </span>
        </p>
      ) : null}
      {docs.length ? (
        <div>
          <p className="text-gray-500 mb-1">Sənədlər</p>
          <ul className="list-disc list-inside text-gray-200 space-y-0.5">
            {docs.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <details className="rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer text-xs text-gray-400">JSON (tam tələblər)</summary>
        <pre className="mt-2 text-[11px] text-gray-300 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(requirements, null, 2)}
        </pre>
      </details>
    </div>
  )
}

export default function ProgramDetailModal({ program, open, onClose, onApply }) {
  if (!program) return null
  const uni = program.university || {}

  return (
    <Modal open={open} onClose={onClose} title={program.name} size="lg" scrollBody>
      <div className="space-y-5">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-1">
          <p className="text-white font-semibold">{uni.name}</p>
          <p className="text-sm text-gray-400">
            {uni.country}
            {uni.city ? ` · ${uni.city}` : ''}
            {uni.world_ranking ? ` · Reytinq #${uni.world_ranking}` : ''}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500">Dərəcə</p>
            <p className="text-white">{program.degree_level}</p>
          </div>
          <div>
            <p className="text-gray-500">Sahə</p>
            <p className="text-white">{program.field}</p>
          </div>
          <div>
            <p className="text-gray-500">Ödəniş</p>
            <p className="text-white">{formatTuition(program.tuition_fee)}</p>
          </div>
          <div>
            <p className="text-gray-500">Müddət</p>
            <p className="text-white">{program.duration_years ? `${program.duration_years} il` : '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Dil</p>
            <p className="text-white">{program.language || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Son tarix</p>
            <p className="text-white">{formatDeadline(program.next_deadline)}</p>
          </div>
        </div>

        {uni.housing_info ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Yataqxana</p>
            <p className="text-sm text-gray-300">{uni.housing_info}</p>
          </div>
        ) : null}

        {uni.funding_info ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Maliyyələşdirmə</p>
            <p className="text-sm text-gray-300">{uni.funding_info}</p>
          </div>
        ) : null}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Qəbul tələbləri</p>
          <RequirementsBlock requirements={program.requirements} />
        </div>

        {program.mentor?.display_name ? (
          <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-4 space-y-2">
            <p className="text-sm text-white font-medium">Mentor: {program.mentor.display_name}</p>
            <p className="text-xs text-gray-400">
              Bu proqram üzrə qəbul və müraciət prosesində pullu konsultasiya ala bilərsiniz.
            </p>
            {program.mentor.user_id ? (
              <a
                href={`/teachers/${program.mentor.user_id}`}
                className="inline-flex text-xs font-semibold text-violet-300 hover:text-white underline"
              >
                Mentor profilinə keç
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Bağla
          </Button>
          <Button type="button" onClick={() => onApply?.(program)}>
            Apply — rəsmi sayt
          </Button>
        </div>
      </div>
    </Modal>
  )
}
