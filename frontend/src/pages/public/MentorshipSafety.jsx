import { Link } from 'react-router-dom'
import PublicMarketingNav from '../../components/public/PublicMarketingNav'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'

const PRINCIPLES = [
  ['Yoxlama nə deməkdir?', 'Mentor profilindəki yoxlama badge-i şəxsiyyət, peşəkar təcrübə və onboarding mərhələlərindən hansının tamamlandığını göstərir. Badge görmək bütün nəticələrə zəmanət deyil; qərar verməzdən əvvəl profil və təklif detallarını yoxlayın.'],
  ['Görüş və ünsiyyət qaydası', 'Görüş məqsədini əvvəlcədən yazın, şəxsi məlumatları paylaşmayın və bütün ödənişləri Mentorix qaydaları daxilində saxlayın. Mentor və mentee qarşılıqlı hörmət, məxfilik və peşəkar sərhədlərə riayət etməlidir.'],
  ['Uyğunluq alınmadıqda', 'İlk intro və ya diaqnostika uyğunluğu yoxlamaq üçündür. Uyğunluq yaranmadıqda mentor dəyişmə, fasilə, ləğv və refund qaydaları tətbiq olunur. Hər müraciət support tərəfindən səbəb kodu ilə araşdırılır.'],
  ['Yetkinlik və təhlükəsizlik', 'MVP mərhələsində mentorluq böyüklər üçün nəzərdə tutulur. Yetkinlik yaşına çatmayanlar üçün ayrıca valideyn razılığı, təhlükəsizlik və eskalasiya qaydaları təsdiqlənmədən 1:1 mentorluq aktivləşdirilmir.'],
]

export default function MentorshipSafety() {
  return (
    <div className="min-h-[100svh] bg-[#f4f6fb] text-slate-800 flex flex-col">
      <PublicMarketingNav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:py-16">
        <Link to="/mentorship" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">← Mentorluğa qayıt</Link>
        <div className="mt-8 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Etibar və təhlükəsizlik</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">Mentorluq necə təhlükəsiz və şəffaf işləyir?</h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">Mentor seçimi, görüş, ödəniş və problem yarandıqda dəstək qaydalarını əvvəlcədən görünən saxlayırıq.</p>
        </div>
        <div className="mt-10 grid gap-4">
          {PRINCIPLES.map(([title, text], index) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-sm font-bold text-emerald-800">0{index + 1}</span>
                <div><h2 className="text-xl font-bold text-slate-900">{title}</h2><p className="mt-2 leading-relaxed text-slate-600">{text}</p></div>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white sm:p-7">
          <h2 className="text-xl font-bold">Problemi bildirmək</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">Təhlükəsizlik, davranış və ya ödəniş problemi ilə qarşılaşdıqda ekran görüntüsü, görüş tarixi və mentor profilini qeyd edib Mentorix dəstəyinə müraciət edin.</p>
          <a href="mailto:support@mentorix.io" className="mt-5 inline-flex rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300">support@mentorix.io</a>
        </div>
      </main>
      <PublicSeoFooter />
    </div>
  )
}
