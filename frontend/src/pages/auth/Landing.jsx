import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { trackEvent, trackRegisterClick, trackPricingView } from '../../lib/analytics'
import { defaultLoginMarketingPayload } from '../../constants/defaultLoginMarketing'
import { setPageSeo } from '../../lib/pageSeo'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import PublicMarketingNav from '../../components/public/PublicMarketingNav'
import { resolveUiLocale } from '../../lib/uiLocale'
import LandingDemoActivityChart from '../../components/landing/LandingDemoActivityChart'
import LandingHeroProductPreview from '../../components/landing/LandingHeroProductPreview'
import CertifiedExamsSection from '../../components/landing/CertifiedExamsSection'
import {
  LandingFeatureTabs,
  LandingHoverCard,
  LandingProblemSolution,
  LandingAudienceGrid,
} from '../../components/landing/LandingInteractiveCards'
import { isMarketingSectionVisible } from '../../lib/loginMarketingVisibility'
import {
  useLandingHero,
  useLandingWhy,
  useLandingAudiences,
  useLandingSteps,
  useLandingFeatures,
  useLandingFaq,
  useLandingCtaBand,
} from '../../lib/landingCopy'
import PublicGoogleSignIn from '../../components/auth/PublicGoogleSignIn'
import FloatingServiceWidget from '../../components/common/FloatingServiceWidget'
import useAuthStore from '../../hooks/useAuth'
import useUiStore from '../../hooks/useUi'

function scrollToId(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function arrayFromT(t, key) {
  const v = t(key, { returnObjects: true })
  return Array.isArray(v) ? v : []
}

/** Ana səhifə — marketinq landing (/). */
export default function Landing() {
  const { t, i18n } = useTranslation()
  const landingSectionSeenRef = useRef(new Set())
  const [demoOpen, setDemoOpen] = useState(false)
  const [demoTab, setDemoTab] = useState('overview')
  const [demoPaneBusy, setDemoPaneBusy] = useState(false)
  const [marketing, setMarketing] = useState(() => defaultLoginMarketingPayload())
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const theme = useUiStore((s) => s.theme)
  const isDark = theme === 'dark'

  useEffect(() => {
    setPageSeo({
      title: t('landing.seo.title'),
      description: t('landing.seo.description'),
      canonicalPath: '/',
      keywords: t('landing.seo.keywords'),
      locale: resolveUiLocale(i18n.language),
      breadcrumbs: [{ name: 'Mentorix', path: '/' }],
    })
  }, [t, i18n.language])

  useEffect(() => {
    if (location.hash === '#mx-planlar') {
      navigate('/qiymetler', { replace: true })
      return
    }
    if (location.hash === '#mx-features' || location.hash === '#mx-steps') {
      const id = location.hash.slice(1)
      window.requestAnimationFrame(() => scrollToId(id))
    }
  }, [location.hash, navigate])

  const why = useLandingWhy(marketing, t, i18n)
  const audiences = useLandingAudiences(marketing, t, i18n)
  const steps = useLandingSteps(marketing, t, i18n)
  const features = useLandingFeatures(marketing, t, i18n)
  const faq = useLandingFaq(marketing, t, i18n)
  const ctaBand = useLandingCtaBand(marketing, t, i18n)

  const showMarketplace = isMarketingSectionVisible(marketing.marketplace)

  const goRegister = (surface) => {
    trackEvent('mx_landing_cta_primary', { surface, event_type: 'register_click' })
    trackRegisterClick()
    setDemoOpen(false)
    navigate('/login')
  }

  const goLogin = (surface) => {
    if (surface) trackEvent('mx_landing_secondary_click', { action: 'login_nav', surface })
    setDemoOpen(false)
    navigate('/login')
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.get('/public/marketing/login', { params: { _: Date.now() } })
        if (!cancelled && data?.success && data?.landing) setMarketing(data.landing)
      } catch {
        /* defolt marketing state qalır */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!demoOpen) return
    setDemoPaneBusy(true)
    const id = window.setTimeout(() => setDemoPaneBusy(false), 400)
    return () => window.clearTimeout(id)
  }, [demoOpen, demoTab])

  useEffect(() => {
    trackEvent('mx_public_landing_view', { path: typeof window !== 'undefined' ? window.location.pathname || '/' : '/' })
  }, [])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const seen = landingSectionSeenRef.current
    const targets = []

    const obs = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue
          const id = en.target instanceof HTMLElement ? en.target.id : ''
          if (!id || seen.has(id)) continue
          seen.add(id)
          trackEvent('mx_landing_section_view', { section_id: id })
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
    )

    const ids = ['mx-hero-preview']
    if (isMarketingSectionVisible(marketing?.why) && why.cards.length > 0) ids.push('mx-why')
    if (isMarketingSectionVisible(marketing.features) && features.items.length > 0) ids.push('mx-features')
    if (audiences.items.length > 0) ids.push('mx-audiences')
    if (isMarketingSectionVisible(marketing.steps) && steps.items.length > 0) ids.push('mx-steps')
    if (isMarketingSectionVisible(marketing.faq) && faq.items.length > 0) ids.push('mx-faq')
    if (isMarketingSectionVisible(ctaBand)) ids.push('mx-cta')
    for (const id of ids) {
      const el = typeof document !== 'undefined' ? document.getElementById(id) : null
      if (el) {
        obs.observe(el)
        targets.push(el)
      }
    }

    return () => {
      for (const el of targets) {
        try {
          obs.unobserve(el)
        } catch {
          /* ignore */
        }
      }
      obs.disconnect()
    }
  }, [
    marketing?.why,
    marketing.steps,
    marketing.features,
    marketing.faq,
    ctaBand,
    why.cards.length,
    audiences.items.length,
    steps.items.length,
    features.items.length,
    faq.items.length,
  ])

  const openDemoTracked = (surface) => {
    trackEvent('mx_landing_demo_open', { surface })
    trackPricingView()
    setDemoTab('overview')
    setDemoOpen(true)
  }

  const onDemoTabTracked = (tabId) => {
    trackEvent('mx_landing_demo_tab', { tab: tabId })
    setDemoTab(tabId)
  }

  const closeDemoTracked = () => {
    trackEvent('mx_landing_demo_close')
    setDemoOpen(false)
  }

  const hero = useLandingHero(marketing, t, i18n)
  const marketplaceCtaLabel = hero.marketplace_cta_label
  const demoSchedule = arrayFromT(t, 'landing.demo.schedule')
  const demoPayments = arrayFromT(t, 'landing.demo.payments')
  const demoAttendance = arrayFromT(t, 'landing.demo.attendance')

  return (
    <div
      className={[
        // overflow-x must not wrap sticky PublicMarketingNav (overflow-x:hidden forces a scrollport and kills sticky).
        'mx-public-page min-h-[100svh] w-full min-w-0 max-w-full',
        isDark ? 'theme-dark bg-[#0b0b0b]' : 'theme-light bg-[#f4f6fb]',
      ].join(' ')}
    >
      <PublicMarketingNav onLogin={() => goLogin('nav')} onStart={() => goRegister('nav')} />

      <div className="w-full max-w-5xl mx-auto px-4 pt-8 sm:pt-10 pb-8 space-y-12 sm:space-y-16 min-w-0 box-border overflow-x-hidden">
        <header className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-8 lg:items-stretch">
          <div className="w-full min-w-0 space-y-4 flex flex-col items-center text-center lg:items-start lg:text-left lg:justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
              <span className="mx-nav-live-dot h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.9)]" />
              🚀 AI Dəstəkli Bütöv Təhsil Ekosistemi
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15] w-full max-w-xl az-text">
              Öyrən, Öyrət, Mentor Ol. Hamısı Bir Platformada.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed w-full max-w-md lg:max-w-xl az-text">
              AI ilə 1 dəqiqəyə imtahan yaradın, cavabları avtomatik qiymətləndirin, peşəkar mentorlardan 1-ə-1 rəhbərlik alın və ya fənninizə uyğun repetitor tapın — hamısı tək paneldə.
            </p>
            <div className="flex flex-col sm:flex-row w-full max-w-md lg:max-w-xl gap-3 pt-2">
              <button
                type="button"
                onClick={() => goRegister('hero_teacher')}
                className="flex-1 inline-flex justify-center items-center text-center rounded-xl bg-primary hover:brightness-95 px-4 py-3.5 min-h-[50px] text-sm font-bold text-[#041018] shadow-lg shadow-primary/20 transition-all"
              >
                Müəllimlər üçün: Pulsuz Sınaq Yarat
              </button>
              <Link
                to="/mentorship"
                className="flex-1 inline-flex justify-center items-center text-center rounded-xl border border-slate-300 bg-white px-4 py-3.5 min-h-[50px] text-sm font-semibold text-slate-800 hover:bg-slate-50 shadow-sm transition-all"
              >
                Tələbələr üçün: Mentor və ya Müəllim Tap
              </Link>
            </div>
            <p className="text-xs text-slate-500">
              Kredit kartı tələb olunmur • Qeydiyyat 30 saniyə alır
            </p>
            {user ? null : <PublicGoogleSignIn className="w-full max-w-md lg:max-w-xl" />}
          </div>

          <LandingHeroProductPreview onOpenDemo={() => openDemoTracked('hero_product_preview')} />
        </header>

        {/* SECTION 2: SOSİAL SÜBUT VƏ METRİKALAR */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900">⚡ 1 Dəqiqəyə</div>
            <p className="text-xs sm:text-sm font-medium text-slate-700 mt-1.5 leading-relaxed">AI sınaq generatoru</p>
          </div>
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900">📊 100% Avtomatik</div>
            <p className="text-xs sm:text-sm font-medium text-slate-700 mt-1.5 leading-relaxed">Cavabların yoxlanılması və analitika</p>
          </div>
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900">📲 0 Tətbiq Məcburiyyəti</div>
            <p className="text-xs sm:text-sm font-medium text-slate-700 mt-1.5 leading-relaxed">Link/QR ilə tək kliklə giriş</p>
          </div>
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900">🎓 QR-Rəsmi</div>
            <p className="text-xs sm:text-sm font-medium text-slate-700 mt-1.5 leading-relaxed">Doğrulana bilən beynəlxalq sertifikatlar</p>
          </div>
        </section>

                {/* SECTION 4: PROBLEM -> HƏLL BLOKU */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-9 space-y-6 shadow-sm">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Test yoxlamaqla saatlar itirməyin — Dərslərinizə fokuslanın
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="p-5 sm:p-6 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2">
              <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                <span className="text-base">🔴</span> Problem
              </div>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                "Gecə saatlarında test kağızlarını tək-tək yoxlamaqdan, balları hesablamaqdan və səhvləri analiz etməkdən yorulmusunuz?"
              </p>
            </div>
            <div className="p-5 sm:p-6 rounded-2xl border border-emerald-200 bg-emerald-50/50 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <span className="text-base">🟢</span> Həll
              </div>
              <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                "Mentorix imtahan bitən kimi bütün cavabları saniyələr içində yoxlayır, balları hesablayır və tələbənin zəif olduğu mövzuları analitik şəkildə çıxarır. Siz sadəcə dərs keçməyə fokuslanırsınız."
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 5: HƏDƏF KÜTLƏ ÜZRƏ XÜSUSİYYƏTLƏR (SEGMENTATION) */}
        <section className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs uppercase font-bold tracking-widest text-emerald-600">Tək Platforma · Üç Əsas Qüvvə</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Hər Rol Üçün Fərdiləşdirilmiş Təcrübə</h2>
            <p className="text-sm sm:text-base text-slate-600">Müəllim, tələbə və mentorlar üçün ayrı-ayrı tətbiqlər axtarmağa ehtiyac yoxdur.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {/* Blok A: Müəllimlər və Repetitorlar */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center text-2xl">
                  👨‍🏫
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">MÜƏLLİMLƏR ÜÇÜN</span>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">Sual tapmaq və ya yazmaq üçün saatlarla vaxt xərcləməyin</h3>
                </div>
                <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>AI Sual Generatoru:</strong> Mövzunu yazın, saniyələr içində test hazırlasın.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Avtomatik Bal:</strong> Tələbə bitirən kimi nəticə və analitika hazır olsun.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Davamiyyət & Ödəniş:</strong> Qruplar, jurnallar və SMS bildirişləri.</span>
                  </li>
                </ul>
              </div>
              <Link
                to="/muellimler-ucun"
                className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:brightness-95 text-[#041018] transition-colors"
              >
                Müəllim panelini kəşf et →
              </Link>
            </div>

            {/* Blok B: Tələbələr və Valideynlər */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-2xl">
                  🎓
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">TƏLƏBƏ & VALİDEYN</span>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">Mürəkkəb qeydiyyat və ya proqram yükləmək məcburiyyəti yoxdur</h3>
                </div>
                <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Asan Sınaq Girişi:</strong> Qeydiyyat tələb olunmadan link və QR ilə qoşulma.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Repetitor Axtarışı:</strong> Rayonunuza və fənninizə uyğun müəllim tapın.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Şəxsi Kabinet:</strong> Nəticələrinizi və inkişaf qrafikinizi pulsuz izləyin.</span>
                  </li>
                </ul>
              </div>
              <Link
                to="/search"
                className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-bold bg-primary hover:brightness-95 text-[#041018] transition-all"
              >
                Müəllim və ya Repetitor tap →
              </Link>
            </div>

            {/* Blok C: Mentorluq Platforması */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center text-2xl">
                  🚀
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">MENTORLUQ</span>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">Hədəflərinizə çatmaq üçün peşəkar mentorlardan 1-ə-1 rəhbərlik alın</h3>
                </div>
                <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Geniş Mentor Şəbəkəsi:</strong> İT, Karyera, Dizayn və Biznes üzrə görüşlər.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Fərdi Yol Xəritəsi:</strong> Hədəfə çatmaq üçün addım-addım plan və tapşırıqlar.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>Tək Hesab Rahatlığı:</strong> İstər mentor olun, istərsə də mentee.</span>
                  </li>
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/mentorship"
                  className="inline-flex items-center justify-center px-3 py-2 rounded-xl text-xs font-semibold bg-primary hover:brightness-95 text-[#041018] text-center transition-colors"
                >
                  Mentor Tap
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center px-3 py-2 rounded-xl text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-center transition-colors"
                >
                  Mentor Ol
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: SERTİFİKATLI İMTAHANLAR */}
        <section className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-9 space-y-4 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Beynəlxalq Standartlı Sınaqlar</span>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900">Sertifikatlı İmtahanlar və Qiymətləndirmə</h3>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                İT, Data Analytics, Cloud & DevOps və xarici dil imtahanlarına hazırlıq; hər tamamlanmış imtahan üçün unikal QR kodla doğrulanan rəsmi sertifikat təqdim olunur.
              </p>
            </div>
            <div className="shrink-0">
              <Link
                to="/imtahanlar"
                className="inline-flex items-center justify-center px-5 py-3.5 rounded-xl text-xs sm:text-sm font-bold bg-primary hover:brightness-95 text-[#041018] shadow-sm transition-all"
              >
                Sınaq İmtahanlarına Bax →
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION 5: NECƏ İŞLƏYİR? (HOW IT WORKS - 4 SADƏ ADDIM) */}
        <section id="mx-steps" className="space-y-6 scroll-mt-24">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <span className="text-xs uppercase font-bold tracking-widest text-emerald-600">Sadə Və Sürətli</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Necə İşləyir?</h2>
            <p className="text-sm text-slate-600">4 sadə addımla təhsilinizi və mentorluq prosesinizi başladın.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-sm">
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">01</div>
              <div className="text-base font-bold text-slate-900">Pulsuz hesab açın</div>
              <p className="text-xs text-slate-600 leading-relaxed">30 saniyəyə qeydiyyatdan keçin və ya Google ilə dərhal daxil olun.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-sm">
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">02</div>
              <div className="text-base font-bold text-slate-900">Sınaq və ya Mentor seçin</div>
              <p className="text-xs text-slate-600 leading-relaxed">AI ilə avtomatik test yaradın və ya məqsədinizə uyğun mentor tapın.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-sm">
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">03</div>
              <div className="text-base font-bold text-slate-900">Paylaşın və ya Qoşulun</div>
              <p className="text-xs text-slate-600 leading-relaxed">Link və ya QR kodla tələbələrinizi dəvət edin, 1-on-1 görüş təyin edin.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">4</div>
              <div className="text-base font-bold text-slate-900">Nəticəni Analiz Edin</div>
              <p className="text-xs text-slate-600 leading-relaxed">Avtomatik qiymətləndirmə, zəif mövzular və inkişaf analitikası alın.</p>
            </div>
          </div>
        </section>

        {/* SECTION 6: REAL İSTİFADƏÇİ RƏYLƏRİ */}
        <section className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <span className="text-xs uppercase font-bold tracking-widest text-emerald-600">Etibar Və Təcrübə</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">İstifadəçilərimiz Nə Deyir?</h2>
            <p className="text-sm text-slate-600">Platformamızdan gündəlik istifadə edən müəllim və mentee-lərin təcrübəsi.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-3 shadow-sm">
              <div className="flex items-center gap-1 text-amber-400 text-sm">★★★★★</div>
              <p className="text-sm text-slate-700 italic leading-relaxed">
                "Əvvəllər 30 tələbənin sınaq vərəqlərini yoxlamaq saatlarımı alırdı. Mentorix-in AI sual generatoru və avtomatik bal hesablama sistemi sayəsində indi imtahan bitən saniyədə bütün nəticələr və valideyn hesabatı hazırdır."
              </p>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">Rəna Məmmədova</div>
                  <div className="text-[11px] text-slate-500">Riyaziyyat müəllimi & Repetitor</div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold">Müəllim</span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-3 shadow-sm">
              <div className="flex items-center gap-1 text-amber-400 text-sm">★★★★★</div>
              <p className="text-sm text-slate-700 italic leading-relaxed">
                "Karyera keçidi üçün Python və Data analitika üzrə mentor axtarırdım. Mentorix-də birbaşa uyğun mentor tapdım, 1-on-1 yol xəritəsi çəkdik və 2 ay içində ilk junior iş təklifimi aldım."
              </p>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">Kamran Əliyev</div>
                  <div className="text-[11px] text-slate-500">Data Analytics Mentee</div>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">Mentee</span>
              </div>
            </div>
          </div>
        </section>

        <CertifiedExamsSection onHowItWorks={() => scrollToId('mx-steps')} />

        {showMarketplace ? (
          <section
            id="mx-marketplace"
            className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-4 shadow-sm motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_16px_40px_-20px_rgba(0,229,176,0.45)]"
          >
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              {t('landing.marketplace.badge')}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{t('landing.marketplace.title')}</h2>
            <p className="text-base text-slate-600 leading-relaxed max-w-2xl">{t('landing.marketplace.desc')}</p>
            <Link
              to="/search"
              onClick={() =>
                trackEvent('mx_landing_marketplace_cta', { surface: 'marketplace_section', action: 'map_search' })
              }
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-3.5 min-h-[48px] text-sm font-bold text-emerald-600 hover:bg-emerald-100 transition-colors"
            >
              {marketplaceCtaLabel}
            </Link>
          </section>
        ) : null}



        <section id="mx-pricing-teaser" className="scroll-mt-24">
          <p className="text-base text-slate-600">
            {t('landing.pricingTeaser.hint')}{' '}
            <Link
              to="/qiymetler"
              onClick={() => trackEvent('mx_landing_pricing_teaser', { surface: 'landing' })}
              className="font-semibold text-primary hover:brightness-110"
            >
              {t('landing.pricingTeaser.label')} →
            </Link>
          </p>
        </section>

        {isMarketingSectionVisible(marketing.faq) && faq.items.length > 0 ? (
          <section id="mx-faq" className="space-y-4 scroll-mt-8">
            <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{faq.heading}</h2>
            <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm">
              {faq.items.map((it, i) => (
                <details key={`faq-${i}`} className="group p-4 sm:p-5">
                  <summary className="cursor-pointer text-base font-semibold text-slate-900 list-none flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <span>{it.q}</span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 text-xl font-bold leading-none group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">{it.a}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        {/* SECTION 7: YEKUN CALL TO ACTION */}
        <section id="mx-cta" className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-10 shadow-sm scroll-mt-8 text-center sm:text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <span className="text-xs uppercase font-bold tracking-widest text-emerald-700">Dərhal Başlayın</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Təhsil Prosesinizi Bu Gün Rəqəmsallaşdırın</h2>
            <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
              Müəllimlər, tələbələr və mentorlar üçün vahid ekosistem. İndi başlayın və ilk sınağınızı 1 dəqiqəyə yaradın.
            </p>
          </div>
          <div className="shrink-0 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => goRegister('cta_band')}
              className="inline-flex justify-center items-center rounded-xl bg-primary hover:brightness-95 px-6 py-4 min-h-[50px] text-sm sm:text-base font-bold text-[#041018] shadow-lg shadow-primary/20 transition-all"
            >
              Pulsuz Başla
            </button>
            <Link
              to="/mentorship"
              className="inline-flex justify-center items-center rounded-xl border border-slate-300 bg-white px-5 py-4 min-h-[50px] text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-all"
            >
              Mentor tap
            </Link>
          </div>
        </section>

        <PublicSeoFooter className="rounded-none sm:rounded-2xl overflow-hidden" />
      </div>

      <FloatingServiceWidget />

      {demoOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('landing.demo.dialogLabel')}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDemoTracked()
          }}
        >
          <div className="w-full max-w-2xl max-h-[min(92dvh,800px)] flex flex-col rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl overflow-hidden shadow-black/50">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-[#111] shrink-0">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{t('landing.demo.title')}</div>
                <div className="text-[11px] text-gray-500">{t('landing.demo.subtitle')}</div>
              </div>
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 shrink-0 min-h-[44px] min-w-[44px]"
                onClick={() => closeDemoTracked()}
              >
                {t('landing.demo.close')}
              </button>
            </div>

            <div className="flex gap-2 p-2 sm:p-2 border-b border-white/10 bg-[#101010] shrink-0 overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
              {[
                { id: 'overview', label: t('landing.demo.tabs.overview') },
                { id: 'schedule', label: t('landing.demo.tabs.schedule') },
                { id: 'payments', label: t('landing.demo.tabs.payments') },
                { id: 'attendance', label: t('landing.demo.tabs.attendance') },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onDemoTabTracked(tab.id)}
                  className={`rounded-lg px-4 py-2.5 min-h-[44px] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    demoTab === tab.id
                      ? 'bg-primary/20 text-primary border border-primary/35'
                      : 'text-gray-400 border border-transparent hover:bg-white/5 hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-h-0 flex flex-col bg-[#0b0b0b]">
              {demoPaneBusy ? (
                <div
                  className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b0b0b]/70 backdrop-blur-[1px] motion-safe:transition-opacity motion-safe:duration-200"
                  aria-hidden
                >
                  <div className="h-9 w-9 rounded-full border-2 border-white/15 border-t-primary motion-safe:animate-spin" />
                </div>
              ) : null}

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div key={demoTab} className="p-4 pb-3 space-y-4 text-sm animate-demo-enter">
                  {demoTab === 'overview' ? (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          [t('landing.demo.kpis.students'), '8'],
                          [t('landing.demo.kpis.lessons'), '5'],
                          [t('landing.demo.kpis.pendingPay'), '2'],
                          [t('landing.demo.kpis.sms'), '12'],
                        ].map(([k, v]) => (
                          <div key={k} className="rounded-xl border border-white/10 bg-[#151515] p-3">
                            <div className="text-[10px] text-gray-500">{k}</div>
                            <div className="text-lg font-semibold text-white mt-0.5 tabular-nums">{v}</div>
                          </div>
                        ))}
                      </div>
                      <LandingDemoActivityChart />
                    </>
                  ) : null}

                  {demoTab === 'schedule' ? (
                    <div className="space-y-2">
                      {demoSchedule.map((row) => (
                        <div
                          key={`${row.time}-${row.title}`}
                          className="w-full text-left rounded-xl border border-white/10 bg-[#151515] px-3 py-3 flex gap-3 items-center min-h-[52px]"
                        >
                          <div className="rounded-lg bg-primary/15 border border-primary/25 text-primary text-xs font-bold px-2 py-1.5 min-w-[52px] text-center shrink-0">
                            {row.time}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-gray-100 truncate">{row.title}</div>
                            <div className={`text-[11px] mt-0.5 ${row.ok ? 'text-emerald-400/90' : 'text-amber-300/95'}`}>
                              {row.status}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {demoTab === 'payments' ? (
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wide text-gray-500 bg-[#161616] px-3 py-2 border-b border-white/10">
                        <div className="col-span-5">{t('landing.demo.paymentsTable.student')}</div>
                        <div className="col-span-4">{t('landing.demo.paymentsTable.amount')}</div>
                        <div className="col-span-3 text-right">{t('landing.demo.paymentsTable.status')}</div>
                      </div>
                      {demoPayments.map((row) => (
                        <div
                          key={row.name}
                          className="grid grid-cols-12 gap-2 items-center px-3 py-3 border-b border-white/5 text-xs bg-[#121212]"
                        >
                          <div className="col-span-5 text-gray-200 font-medium truncate min-w-0">{row.name}</div>
                          <div className="col-span-4 text-gray-400 tabular-nums">{row.amount}</div>
                          <div className="col-span-3 text-right">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                                row.tone === 'paid'
                                  ? 'border-emerald-500/35 text-emerald-300 bg-emerald-500/10'
                                  : row.tone === 'pending'
                                    ? 'border-amber-500/35 text-amber-200 bg-amber-500/10'
                                    : 'border-red-500/30 text-red-300 bg-red-500/10'
                              }`}
                            >
                              {row.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {demoTab === 'attendance' ? (
                    <div className="space-y-3">
                      {demoAttendance.map((row) => (
                        <div key={row.label} className="rounded-xl border border-white/10 bg-[#151515] p-3">
                          <div className="flex justify-between text-xs text-gray-200 font-medium mb-2 gap-2">
                            <span className="truncate">{row.label}</span>
                            <span className="text-primary tabular-nums shrink-0">{row.pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-300/85"
                              style={{ width: `${row.pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0 border-t border-white/10 bg-[#0a0a0a]/95 backdrop-blur-md px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  className="w-full rounded-xl bg-primary px-4 py-4 min-h-[52px] text-sm font-bold text-[#041018] shadow-lg shadow-primary/35 hover:brightness-95"
                  onClick={() => goRegister('demo_modal_footer')}
                >
                  {hero.primary_cta_label}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
