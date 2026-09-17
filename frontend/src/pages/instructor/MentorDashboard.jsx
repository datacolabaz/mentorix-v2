import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../hooks/useAuth'
import useUiStore from '../../hooks/useUi'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import KpiCard from '../../components/common/KpiCard'
import { useToast } from '../../components/common/Toast'

export default function MentorDashboard() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { theme } = useUiStore()
  const toast = useToast()
  const isDark = theme === 'dark'

  const [services, setServices] = useState([
    {
      id: 1,
      title: 'Python & AI üzrə fərdi mentorluq',
      topic: 'Proqramlaşdırma',
      format: 'Online (1-on-1)',
      price: '40 AZN',
      duration: '60 dəqiqə',
      active: true,
    },
    {
      id: 2,
      title: 'Data Analytics Career Mentoring',
      topic: 'Karyera planlaması',
      format: 'Aylıq Paket',
      price: '120 AZN / ay',
      duration: '4 sessiya',
      active: true,
    },
  ])

  const [applications, setApplications] = useState([
    {
      id: 1,
      name: 'Aysel Məmmədova',
      avatar: null,
      goal: 'Junior Python Developer işinə qəbul üçün yol xəritəsi və kod analizi',
      service: 'Python & AI üzrə fərdi mentorluq',
      date: 'Bugün, 14:20',
      status: 'pending',
    },
    {
      id: 2,
      name: 'Murad Əliyev',
      avatar: null,
      goal: 'SQL və PowerBI portfeli hazırlamaq, Mock interview keçmək',
      service: 'Data Analytics Career Mentoring',
      date: 'Dünən, 18:45',
      status: 'pending',
    },
  ])

  const [sessions, setSessions] = useState([
    {
      id: 1,
      time: '18:00',
      day: 'Bugün',
      mentee: 'Aysel Məmmədova',
      topic: 'Python data strukturları & Alqoritmlər',
      format: 'Online',
      status: 'starting_soon',
    },
    {
      id: 2,
      time: '11:00',
      day: 'Sabah',
      mentee: 'Rəşad Quliyev',
      topic: 'CV analizi & LinkedIn optimallaşdırması',
      format: 'Online',
      status: 'scheduled',
    },
  ])

  const handleAcceptApp = (id, name) => {
    setApplications((prev) => prev.filter((a) => a.id !== id))
    toast(`${name} üçün müraciət qəbul edildi!`, 'success')
  }

  const handleRejectApp = (id) => {
    setApplications((prev) => prev.filter((a) => a.id !== id))
    toast('Müraciət imtina edildi', 'info')
  }

  const hrs = new Date().getHours()
  const greetingTime =
    hrs < 12 ? 'Sabahınız xeyir' : hrs < 18 ? 'Günortanız xeyir' : 'Axşamınız xeyir'
  const firstName = user?.full_name?.trim()?.split(/\s+/)[0] || 'Mentor'

  // Profile completion status
  const profileCompletion = 70
  const missingProfileSteps = ['Ekspertiza teqləri', 'Təqvim mövcudluğu']

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-token-text">
            {greetingTime}, {firstName}! 👋
          </h1>
          <p className="text-sm text-token-textMuted mt-1">
            Bugünkü mentorluq və mentee xülasəniz
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/instructor/schedule"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
          >
            <span>📅</span> Təqvimə bax
          </Link>
          <Link
            to="/instructor/teaching-groups"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-token-border bg-token-surface hover:bg-token-surfaceHover text-token-text transition-all"
          >
            <span>➕</span> Yeni xidmət
          </Link>
        </div>
      </div>

      {/* 2. Mentor Profile Completion Banner */}
      {profileCompletion < 100 && (
        <div
          className={[
            'rounded-2xl border p-4 sm:p-5 transition-all shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4',
            isDark
              ? 'bg-purple-950/20 border-purple-800/40 text-purple-200'
              : 'bg-purple-50/80 border-purple-200 text-purple-900',
          ].join(' ')}
        >
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧭</span>
              <h2 className="font-bold text-sm sm:text-base">
                Mentor profilinizi tamamlayın
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-200/80 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300">
                {profileCompletion}% tamamlanıb
              </span>
            </div>
            <p className="text-xs sm:text-sm text-purple-800/80 dark:text-purple-300/80 leading-relaxed">
              Daha çox mentee tərəfindən tapılmaq və 1-on-1 müraciətlər almaq üçün profilinizi tamamlayın.
            </p>
            {missingProfileSteps.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-purple-700 dark:text-purple-300 pt-0.5">
                <span className="font-semibold">Çatışmayan:</span>
                {missingProfileSteps.map((step) => (
                  <span
                    key={step}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/70 dark:bg-black/30 border border-purple-200 dark:border-purple-800/50 text-[11px]"
                  >
                    ○ {step}
                  </span>
                ))}
              </div>
            )}
          </div>
          <Link
            to="/instructor/settings"
            className="shrink-0 inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition-all"
          >
            Profili tamamla →
          </Link>
        </div>
      )}

      {/* 3. Primary KPI Cards (Row 1 & Row 2) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Row 1 */}
        <KpiCard
          label="Aktiv Mentee-lər"
          value="12"
          sublabel="Aktiv mentorluq alan mentee sayı"
          trend="+2 bu ay"
          trendTone="positive"
        />
        <KpiCard
          label="Bu ay sessiyalar"
          value="18"
          sublabel="Keçirilmiş və planlaşdırılan"
          trend="+5 əvvəlki aya nisbətən"
          trendTone="positive"
        />
        <KpiCard
          label="Orta reytinq"
          value="4.9 ★"
          sublabel="Mentee rəylərinə əsasən"
          trend="14 rəy əsasında"
          trendTone="neutral"
        />
        <KpiCard
          label="Bu ay qazanc"
          value="480 ₼"
          sublabel="Mentorluq sessiyalarından gəlir"
          trend="+20% artım"
          trendTone="positive"
        />

        {/* Row 2 */}
        <KpiCard
          label="Gözləyən müraciətlər"
          value={String(applications.length)}
          sublabel="Təsdiq gözləyən yeni mentee"
          trend={applications.length > 0 ? 'Cavab gözləyir' : 'Hamısı cavablandırılıb'}
          trendTone={applications.length > 0 ? 'primary' : 'neutral'}
        />
        <KpiCard
          label="Profil baxışları"
          value="126"
          sublabel="Son 30 gündə mentor profiliniz"
          trend="+32% baxış artımı"
          trendTone="positive"
        />
        <KpiCard
          label="Tamamlanmış sessiyalar"
          value="87"
          sublabel="Ümumi keçirilmiş 1-on-1 görüş"
          trend="100% davamiyyət"
          trendTone="positive"
        />
        <KpiCard
          label="Növbəti sessiya"
          value="Bugün · 18:00"
          sublabel="Aysel M. (Python)"
          trend="1 saat sonra başlayır"
          trendTone="primary"
        />
      </div>

      {/* 4. Upcoming Sessions & Pending Applications Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Növbəti sessiyalar */}
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-token-text flex items-center gap-2">
                <span>⏱️</span> Növbəti sessiyalar
              </h2>
              <p className="text-xs text-token-textMuted mt-0.5">
                Qarşıdan gələn 1-on-1 mentorluq görüşləriniz
              </p>
            </div>
            <Link
              to="/instructor/schedule"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 transition-colors"
            >
              Bütün sessiyalara bax →
            </Link>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-xl border border-dashed border-token-border">
              <span className="text-3xl">🗓️</span>
              <p className="text-sm font-semibold text-token-text mt-2">
                Növbəti sessiya yoxdur
              </p>
              <p className="text-xs text-token-textMuted mt-1">
                İlk sessiyanız təsdiqləndikdən sonra burada görünəcək.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sessions.map((sess) => (
                <div
                  key={sess.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-token-border bg-token-surfaceHover/40 hover:bg-token-surfaceHover transition-all"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] uppercase font-bold">{sess.day}</span>
                      <span className="text-xs font-extrabold">{sess.time}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-token-text truncate">
                        {sess.mentee}
                      </div>
                      <div className="text-xs text-token-textMuted truncate mt-0.5">
                        {sess.topic}
                      </div>
                      <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {sess.format}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 ml-2">
                    <Link
                      to="/instructor/live/history"
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
                    >
                      Qoşul
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Yeni müraciətlər */}
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-token-text flex items-center gap-2">
                <span>📬</span> Yeni müraciətlər
              </h2>
              <p className="text-xs text-token-textMuted mt-0.5">
                Mentee-lərin sizə göndərdiyi mentorluq sorğuları
              </p>
            </div>
            <Link
              to="/instructor/inquiries"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 transition-colors"
            >
              Bütün müraciətlərə bax →
            </Link>
          </div>

          {applications.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-xl border border-dashed border-token-border">
              <span className="text-3xl">✨</span>
              <p className="text-sm font-semibold text-token-text mt-2">
                Gözləyən yeni müraciət yoxdur
              </p>
              <p className="text-xs text-token-textMuted mt-1">
                Yeni tələbələr müraciət etdikdə bildiriş alacaqsınız.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="p-3.5 rounded-xl border border-token-border bg-token-surfaceHover/40 hover:bg-token-surfaceHover transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-600 font-bold flex items-center justify-center text-xs shrink-0">
                        {app.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-token-text truncate">
                          {app.name}
                        </div>
                        <div className="text-[10px] text-token-textMuted">{app.date}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 dark:bg-purple-950 dark:text-purple-300 px-2 py-0.5 rounded-md truncate max-w-[140px]">
                      {app.service}
                    </span>
                  </div>

                  <p className="text-xs text-token-textMuted bg-token-surface p-2.5 rounded-lg border border-token-border/60 leading-relaxed">
                    "{app.goal}"
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleRejectApp(app.id)}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                      İmtina et
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAcceptApp(app.id, app.name)}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
                    >
                      Qəbul et
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 5. Mentor Services / Packages Card */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-token-text flex items-center gap-2">
              <span>💼</span> Mentor xidmətləriniz
            </h2>
            <p className="text-xs text-token-textMuted mt-0.5">
              Mentee-lərə təklif etdiyiniz fərdi sessiyalar və aylıq mentorluq paketləri
            </p>
          </div>
          <Link
            to="/instructor/teaching-groups"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-500"
          >
            <span>+</span> Yeni xidmət əlavə et
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {services.map((srv) => (
            <div
              key={srv.id}
              className="p-4 rounded-xl border border-token-border bg-token-surfaceHover/30 hover:border-emerald-500/40 transition-all flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm text-token-text">{srv.title}</h3>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Aktiv
                  </span>
                </div>
                <p className="text-xs text-token-textMuted mt-1">{srv.topic} · {srv.duration}</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-token-border/50">
                <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                  {srv.price}
                </span>
                <Link
                  to="/instructor/teaching-groups"
                  className="text-xs font-semibold text-token-textMuted hover:text-token-text transition-colors"
                >
                  Redaktə et →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
