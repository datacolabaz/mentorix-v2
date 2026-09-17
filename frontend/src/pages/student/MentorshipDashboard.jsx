import { Link } from 'react-router-dom'
import useAuthStore from '../../hooks/useAuth'

const NEXT_STEPS = [
  ['01', 'CV-nizi yükləyin', 'Mentorunuzun rəy verməsi üçün son versiyanı paylaşın.'],
  ['02', 'Müsahibə suallarını hazırlayın', 'Növbəti sessiyada 3 real sual üzərində işləyin.'],
  ['03', 'Yol xəritəsini yeniləyin', 'Növbəti milestone üçün tarix və ölçü müəyyən edin.'],
]

export default function MentorshipDashboard() {
  const { user } = useAuthStore()
  const firstName = user?.full_name?.trim()?.split(/\s+/)[0] || 'Emil'

  return (
    <div className="min-h-full bg-[#f4f7fa] px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Mentorluq</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Salam, {firstName}</h1>
            <p className="mt-1 text-sm text-slate-600">İnkişafınızı, görüşlərinizi və növbəti addımlarınızı bir yerdən izləyin.</p>
          </div>
          <Link to="/mentorship/goals" className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-[#041018] shadow-sm hover:brightness-95">Mentor tap →</Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">Aktiv məqsəd</p>
                <h2 className="mt-2 text-2xl font-bold">Müsahibəyə hazırlıq</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">Karyera keçidi üçün CV, portfolio və mock interview mərhələlərini tamamlayın.</p>
              </div>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-bold text-emerald-300">3 / 5 mərhələ</span>
            </div>
            <div className="mt-7 h-2 rounded-full bg-white/10"><div className="h-2 w-3/5 rounded-full bg-emerald-400" /></div>
            <div className="mt-3 flex justify-between text-xs text-slate-400"><span>Başlanğıc</span><span>60%</span><span>Nəticə</span></div>
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Növbəti görüş</p>
            <h2 className="mt-3 text-xl font-bold text-slate-950">Çərşənbə, 20:00</h2>
            <p className="mt-2 text-sm text-slate-600">Nigar Məmmədova · Karyera mentorluğu</p>
            <Link to="/student/schedule" className="mt-6 inline-flex text-sm font-bold text-emerald-700 hover:text-emerald-900">Görüşə hazırlaş →</Link>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Bu həftə</p><h2 className="mt-2 text-xl font-bold text-slate-950">Növbəti addımlar</h2></div><Link to="/student/tasks" className="text-xs font-bold text-emerald-700">Hamısına bax →</Link></div>
            <div className="mt-5 space-y-3">{NEXT_STEPS.map(([number, title, text]) => <div key={number} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-xs font-extrabold text-emerald-700">{number}</span><div><h3 className="text-sm font-bold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-relaxed text-slate-600">{text}</p></div></div>)}</div>
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Son sessiya qeydi</p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">Karyera istiqaməti və portfolio</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">Növbəti görüşdə portfolio case study-ni daha konkret nəticələr və ölçülərlə yeniləmək qərara alındı.</p>
            <div className="mt-5 rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-800">Action point</p><p className="mt-1 text-sm font-semibold text-emerald-950">2 portfolio layihəsini seç və nəticə metriklərini əlavə et.</p></div>
            <Link to="/student/materials" className="mt-5 inline-flex text-sm font-bold text-emerald-700 hover:text-emerald-900">Resurslara bax →</Link>
          </section>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Münasibət</p><h2 className="mt-2 text-xl font-bold text-slate-950">Mentorunuzla əlaqə</h2></div><Link to="/student/direct-chat" className="text-sm font-bold text-emerald-700">Mesaj göndər →</Link></div>
          <div className="mt-5 flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700">N</div><div><p className="font-bold text-slate-950">Nigar Məmmədova</p><p className="text-sm text-slate-600">Career & Interview Mentor · 4.9 ★</p></div></div><span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700">Aktiv münasibət</span></div>
        </section>
      </div>
    </div>
  )
}

export { NEXT_STEPS }
