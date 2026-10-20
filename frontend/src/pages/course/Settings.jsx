import CourseBrandingForm from '../../components/course/CourseBrandingForm'

export default function CourseSettings() {
  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-2xl mx-auto w-full space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain tracking-tight">Parametrlər</h1>
        <p className="text-token-textMuted text-sm mt-1">Kurs adı, loqo və filial məlumatları</p>
      </div>
      <CourseBrandingForm />
    </div>
  )
}
