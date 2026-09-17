import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../hooks/useAuth'
import useUiStore from '../../hooks/useUi'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import KpiCard from '../../components/common/KpiCard'
import { useToast } from '../../components/common/Toast'
import BookingModal from '../../components/common/BookingModal'
import RoadmapTracker from '../../components/common/RoadmapTracker'

export default function MentorDashboard() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { theme } = useUiStore()
  const toast = useToast()
  const isDark = theme === 'dark'

  const [bookingOpen, setBookingOpen] = useState(false)
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [newService, setNewService] = useState({
    title: '',
    topic: 'Karyera planlaması',
    price: '',
    duration: '60 dəqiqə',
  })

  const [services, setServices] = useState([])

  const [applications, setApplications] = useState([])

  const [sessions, setSessions] = useState([])

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
          <button
            type="button"
            onClick={() => setBookingOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:brightness-95 text-[#041018] shadow-sm transition-all"
          >
            <span>📅</span> Yeni sessiya təyin et
          </button>
          <button
            type="button"
            onClick={() => setServiceModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-token-border bg-token-surface hover:bg-token-surfaceHover text-token-text transition-all"
          >
            <span>➕</span> Yeni xidmət
          </button>
        </div>
      </div>

      {/* 2. Mentor Profile Completion Banner */}
      {profileCompletion < 100 && (
        <div
          className={[
            'rounded-2xl border p-4 sm:p-5 transition-all shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4',
            isDark
              ? 'bg-slate-900 border-slate-800 text-slate-100'
              : 'bg-white border-slate-200 text-slate-900',
          ].join(' ')}
        >
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧭</span>
              <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Mentor profilinizi tamamlayın
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {profileCompletion}% tamamlanıb
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              Daha çox mentee tərəfindən tapılmaq və 1-on-1 müraciətlər almaq üçün profilinizi tamamlayın.
            </p>
            {missingProfileSteps.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 pt-0.5">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Çatışmayan:</span>
                {missingProfileSteps.map((step) => (
                  <span
                    key={step}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-medium"
                  >
                    ○ {step}
                  </span>
                ))}
              </div>
            )}
          </div>
          <Link
            to="/instructor/settings"
            className="shrink-0 inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-bold bg-primary hover:brightness-95 text-[#041018] shadow-sm transition-all"
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
          value="0"
          sublabel="Aktiv mentorluq alan mentee sayı"
          trend="İlk mentee-nizi gözləyir"
          trendTone="positive"
        />
        <KpiCard
          label="Bu ay sessiyalar"
          value="0"
          sublabel="Keçirilmiş və planlaşdırılan"
          trend="Planlaşdırılmış sessiya yoxdur"
          trendTone="positive"
        />
        <KpiCard
          label="Orta reytinq"
          value="—"
          sublabel="Mentee rəylərinə əsasən"
          trend="Hələ rəy yoxdur"
          trendTone="neutral"
        />
        <KpiCard
          label="Bu ay qazanc"
          value="0 ₼"
          sublabel="Mentorluq sessiyalarından gəlir"
          trend="Bu ay gəlir yoxdur"
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
          value="0"
          sublabel="Son 30 gündə mentor profiliniz"
          trend="Son 30 gün"
          trendTone="positive"
        />
        <KpiCard
          label="Tamamlanmış sessiyalar"
          value="0"
          sublabel="Ümumi keçirilmiş 1-on-1 görüş"
          trend="Ümumi sessiya"
          trendTone="positive"
        />
        <KpiCard
          label="Növbəti sessiya"
          value="Yoxdur"
          sublabel="Qarşıdan gələn sessiya"
          trend="Planlaşdırılmayıb"
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
                      className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-bold bg-primary hover:brightness-95 text-[#041018] shadow-sm transition-all"
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
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0">
                        {app.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-token-text truncate">
                          {app.name}
                        </div>
                        <div className="text-[10px] text-token-textMuted">{app.date}</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-900 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-md font-bold truncate max-w-[140px]">
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
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-primary hover:brightness-95 text-[#041018] shadow-sm transition-all"
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
          <button
            type="button"
            onClick={() => setServiceModalOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-500"
          >
            <span>+</span> Yeni xidmət əlavə et
          </button>
        </div>

        {services.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-xl border border-dashed border-token-border">
            <span className="text-3xl">💼</span>
            <p className="text-sm font-semibold text-token-text mt-2">
              Hələ aktiv mentor xidmətiniz yoxdur
            </p>
            <p className="text-xs text-token-textMuted mt-1">
              Mentee-lərin sizə müraciət edə bilməsi üçün ilk fərdi mentorluq xidmətinizi yaradın.
            </p>
            <button
              type="button"
              onClick={() => setServiceModalOpen(true)}
              className="inline-flex mt-3 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:brightness-95 text-[#041018] shadow-sm transition-all"
            >
              + İlk xidməti əlavə et
            </button>
          </div>
        ) : (
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
        )}
      </Card>
      {/* 6. Hədəflər və Yol Xəritəsi (Interactive Action Plan) */}
      <RoadmapTracker />

      {/* Booking Modal (3-Step Wizard) */}
      <BookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        mentorName={user?.full_name || 'Mentor'}
        onBookSuccess={() => toast('Sessiya uğurla planlaşdırıldı!', 'success')}
      />

      {/* Service Create Modal */}
      {serviceModalOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setServiceModalOpen(false)}
        >
          <div className="w-full max-w-md bg-white dark:bg-surface-2 rounded-2xl border border-slate-200 dark:border-white/10 p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Yeni Mentorluq Xidməti Əlavə Et</h3>
              <button
                type="button"
                onClick={() => setServiceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Xidmətin Adı</label>
                <input
                  type="text"
                  value={newService.title}
                  onChange={(e) => setNewService({ ...newService, title: e.target.value })}
                  placeholder="məs: Python & AI Fərdi Mentorluq"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Mövzu / Sahə</label>
                <select
                  value={newService.topic}
                  onChange={(e) => setNewService({ ...newService, topic: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white outline-none focus:border-primary"
                >
                  <option value="Karyera planlaması">Karyera planlaması</option>
                  <option value="Proqramlaşdırma & İT">Proqramlaşdırma & İT</option>
                  <option value="Data & Süni İntellekt">Data & Süni İntellekt</option>
                  <option value="UI/UX Dizayn">UI/UX Dizayn</option>
                  <option value="Xaricdə Təhsil">Xaricdə Təhsil</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Qiymət</label>
                  <input
                    type="text"
                    value={newService.price}
                    onChange={(e) => setNewService({ ...newService, price: e.target.value })}
                    placeholder="məs: 40 AZN"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Format / Müddət</label>
                  <input
                    type="text"
                    value={newService.duration}
                    onChange={(e) => setNewService({ ...newService, duration: e.target.value })}
                    placeholder="məs: 60 dəqiqə"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setServiceModalOpen(false)}
                className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Ləğv et
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newService.title.trim()) {
                    toast('Xidmətin adını qeyd edin', 'error')
                    return
                  }
                  setServices((prev) => [
                    ...prev,
                    {
                      id: Date.now(),
                      title: newService.title,
                      topic: newService.topic,
                      price: newService.price || 'Razılaşma ilə',
                      duration: newService.duration || '60 dəqiqə',
                      active: true,
                    },
                  ])
                  setServiceModalOpen(false)
                  setNewService({ title: '', topic: 'Karyera planlaması', price: '', duration: '60 dəqiqə' })
                  toast('Yeni mentorluq xidməti əlavə edildi!', 'success')
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:brightness-95 text-[#041018] shadow-sm transition-all"
              >
                Xidməti Əlavə Et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
