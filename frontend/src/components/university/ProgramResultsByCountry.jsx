import ProgramCard from './ProgramCard'
import { countryFlag } from '../../lib/universitySearch'

export default function ProgramResultsByCountry({ groups, onDetails, onApply }) {
  if (!groups?.length) return null

  return (
    <div className="space-y-8">
      {groups.map(({ country, programs }) => (
        <section key={country} className="space-y-3">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <span className="text-lg" aria-hidden>
              {countryFlag(country)}
            </span>
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-300">
              {country}
            </h2>
            <span className="text-xs text-gray-500">({programs.length})</span>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {programs.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                onDetails={onDetails}
                onApply={onApply}
                showCountryBadge
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
