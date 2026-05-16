import CourseBrandingForm from './CourseBrandingForm'

export default function CourseSetupModal({ open, onComplete }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-2xl border border-emerald-500/25 bg-token-surfaceCard shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-setup-title"
      >
        <h2 id="course-setup-title" className="font-display font-bold text-lg text-white mb-1">
          Kursunuzu təyin edin
        </h2>
        <p className="text-sm text-token-textMuted mb-5">
          Panelə daxil olmazdan əvvəl kurs adını və loqonu qeyd edin. Bu məlumat sidebar və dashboardda görünəcək.
        </p>
        <CourseBrandingForm
          showHint={false}
          submitLabel="Davam et"
          onSaved={() => onComplete?.()}
        />
      </div>
    </div>
  )
}
