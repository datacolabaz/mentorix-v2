import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import { ArrowRightIcon, CompassIcon, GraduationIcon, SchoolIcon, TeacherIcon } from './icons'

const AUDIENCES = [
  { key: 'teacher', to: '/muellimler-ucun', Icon: TeacherIcon },
  { key: 'school', to: '/elaqe', Icon: SchoolIcon },
  { key: 'student', to: '/telebeler-ucun', Icon: GraduationIcon },
  { key: 'mentorship', to: '/mentorship', Icon: CompassIcon, requiresMentorship: true },
]

export default function AudienceSection({ mentorshipEnabled = false }) {
  const { t } = useTranslation()
  const audiences = AUDIENCES.filter((a) => !a.requiresMentorship || mentorshipEnabled)

  return (
    <section id="mx-audiences" aria-labelledby="mx-audiences-title" className="border-y border-line bg-canvas-subtle">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionHeading id="mx-audiences-title" title={t('home.audiences.title')} />
        <ul className={`grid grid-cols-1 gap-5 sm:grid-cols-2 ${audiences.length > 3 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {audiences.map(({ key, to, Icon }) => (
            <li key={key} className="flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-card">
              <Icon className="mb-4 h-7 w-7 text-brand-text" />
              <h3 className="text-h3 text-fg">{t(`home.audiences.items.${key}.title`)}</h3>
              <p className="mt-2 text-body text-fg-secondary">{t(`home.audiences.items.${key}.body`)}</p>
              <Link
                to={to}
                className="mt-auto inline-flex items-center gap-1.5 self-start rounded-sm pt-4 text-body-sm font-semibold text-brand-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {t(`home.audiences.items.${key}.cta`)}
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
