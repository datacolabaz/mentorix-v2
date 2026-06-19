import Modal from '../common/Modal'
import Button from '../common/Button'
import { formatDeadline, formatTuition, fieldLabel } from '../../lib/universitySearch'

const LANGUAGE_EXAM_LABELS = {
  ielts: 'IELTS',
  toefl: 'TOEFL',
  duolingo: 'Duolingo',
  telc: 'TELC',
  goethe: 'Goethe',
}

const REQUIREMENT_LABELS = {
  min_gpa: 'Minimum GPA',
  min_language: 'Dil imtahanı',
  documents: 'Sənədlər',
  work_experience_years: 'İş təcrübəsi',
  portfolio_required: 'Portfolio',
  entrance_exam: 'Qəbul imtahanı',
  interview: 'Müsahibə',
  notes: 'Qeyd',
}

const DOCUMENT_LABELS = {
  CV: 'CV (resümə)',
  Transcript: 'Transkript',
  'Motivation letter': 'Motivasiya məktubu',
  'Research proposal': 'Tədqiqat planı',
  Passport: 'Pasport',
  Diploma: 'Diplom',
}

function formatRequirementValue(key, value) {
  if (value == null || value === '') return null
  if (key === 'min_language' && typeof value === 'object') {
    const parts = Object.entries(value)
      .filter(([, score]) => score != null && score !== '')
      .map(([exam, score]) => `${LANGUAGE_EXAM_LABELS[exam] || exam.toUpperCase()} ${score}`)
    return parts.length ? parts.join(', ') : null
  }
  if (key === 'documents' && Array.isArray(value)) {
    return value.map((doc) => DOCUMENT_LABELS[doc] || doc)
  }
  if (typeof value === 'boolean') return value ? 'Bəli' : 'Xeyr'
  if (Array.isArray(value)) return value.map((item) => String(item))
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => `${REQUIREMENT_LABELS[k] || k}: ${v}`)
      .join(', ')
  }
  return String(value)
}

function RequirementsBlock({ requirements }) {
  if (!requirements || typeof requirements !== 'object') {
    return <p className="text-sm text-gray-400">Tələblər göstərilməyib.</p>
  }

  const entries = Object.entries(requirements)
    .map(([key, value]) => {
      const formatted = formatRequirementValue(key, value)
      if (formatted == null) return null
      return { key, label: REQUIREMENT_LABELS[key] || key.replace(/_/g, ' '), formatted }
    })
    .filter(Boolean)

  if (!entries.length) {
    return <p className="text-sm text-gray-400">Tələblər göstərilməyib.</p>
  }

  return (
    <div className="space-y-3 text-sm">
      {entries.map(({ key, label, formatted }) => {
        if (key === 'documents' && Array.isArray(formatted)) {
          return (
            <div key={key}>
              <p className="text-gray-500 mb-1">{label}</p>
              <ul className="list-disc list-inside text-gray-200 space-y-0.5">
                {formatted.map((doc) => (
                  <li key={doc}>{doc}</li>
                ))}
              </ul>
            </div>
          )
        }

        return (
          <p key={key}>
            <span className="text-gray-500">{label}:</span>{' '}
            <span className="text-white">{formatted}</span>
          </p>
        )
      })}
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
            <p className="text-white">{fieldLabel(program.field)}</p>
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
