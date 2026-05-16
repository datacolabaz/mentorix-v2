import Card from '../common/Card'

/**
 * Kurs paneli bölmələri üçün vahid placeholder (CRM funksiyaları tezliklə).
 */
export default function CourseSection({ title, description, children }) {
  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-6xl mx-auto w-full space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain tracking-tight">{title}</h1>
        {description ? <p className="text-token-textMuted text-sm mt-1 max-w-2xl">{description}</p> : null}
      </div>
      {children || (
        <Card className="p-6 border border-indigo-500/20">
          <p className="text-sm text-token-textMuted leading-relaxed">
            Bu bölmə hazırlanır — tezliklə tam funksionallıq əlavə olunacaq.
          </p>
        </Card>
      )}
    </div>
  )
}
