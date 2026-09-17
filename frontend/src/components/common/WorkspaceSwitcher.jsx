import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../hooks/useAuth'
import useUiStore from '../../hooks/useUi'
import { useToast } from './Toast'

export default function WorkspaceSwitcher({ className = '' }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  const { user, switchWorkspace } = useAuthStore()
  const { theme } = useUiStore()
  const isDark = theme === 'dark'

  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  if (!user || user.role === 'admin') return null

  const currentRole = String(user.role || '').toLowerCase()
  const currentPersona = String(user.persona || '').toLowerCase()
  const isMentor = currentPersona === 'mentor'
  const isTeacher = currentRole === 'instructor' && !isMentor
  const isStudent = currentRole === 'student' || currentRole === 'mentee'

  let activeTitle = t('workspace.student', { defaultValue: 'İştirakçı / Mentee' })
  let activeIcon = '🎓'
  let activeBadge = 'Mentee'

  if (isMentor) {
    activeTitle = t('workspace.mentor', { defaultValue: 'Mentor kabineti' })
    activeIcon = '🚀'
    activeBadge = 'Mentor'
  } else if (isTeacher) {
    activeTitle = t('workspace.teacher', { defaultValue: 'Müəllim kabineti' })
    activeIcon = '👨‍🏫'
    activeBadge = 'Müəllim'
  }

  const handleSwitch = async (target, path) => {
    try {
      setLoading(true)
      await switchWorkspace(target)
      setIsOpen(false)
      toast(t('workspace.switched', { defaultValue: 'Kabinet dəyişdirildi' }), 'success')
      navigate(path)
    } catch (err) {
      toast(err.message || t('workspace.switchError', { defaultValue: 'Keçid zamanı xəta baş verdi' }), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        type="button"
        disabled={loading}
        onClick={() => setIsOpen((prev) => !prev)}
        className={[
          'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all duration-200',
          isDark
            ? 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-gray-200'
            : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-sm text-slate-800',
        ].join(' ')}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">{activeIcon}</span>
          <div className="min-w-0">
            <div className="truncate text-xs font-bold leading-snug">{activeTitle}</div>
            <div className="text-[10px] text-slate-400 dark:text-gray-400 font-normal">
              {t('workspace.switchPrompt', { defaultValue: 'Profil/Kabineti dəyiş' })}
            </div>
          </div>
        </div>
        <span
          className={[
            'text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md border shrink-0',
            isMentor
              ? 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400'
              : isTeacher
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
          ].join(' ')}
        >
          {activeBadge}
        </span>
      </button>

      {isOpen && (
        <div
          className={[
            'absolute bottom-full left-0 right-0 mb-2 p-2 rounded-2xl border shadow-xl z-[1200] backdrop-blur-md transition-all',
            isDark
              ? 'bg-[#12161f]/95 border-white/10 text-gray-100 shadow-black/50'
              : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-200/70',
          ].join(' ')}
        >
          <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-gray-400">
            {t('workspace.selectRole', { defaultValue: 'İş Rejimi / Kabinet' })}
          </div>

          <div className="mt-1 space-y-1">
            {/* Mentee / Student */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSwitch('student', '/student')}
              className={[
                'w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs font-semibold transition-colors',
                isStudent
                  ? isDark
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-emerald-50 text-emerald-800'
                  : isDark
                    ? 'hover:bg-white/5 text-gray-300'
                    : 'hover:bg-slate-50 text-slate-700',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🎓</span>
                <span>{t('workspace.student', { defaultValue: 'İştirakçı / Mentee kabineti' })}</span>
              </div>
              {isStudent && <span className="text-xs font-bold text-emerald-500">✓</span>}
            </button>

            {/* Teacher */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSwitch('teacher', '/instructor')}
              className={[
                'w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs font-semibold transition-colors',
                isTeacher
                  ? isDark
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-blue-50 text-blue-800'
                  : isDark
                    ? 'hover:bg-white/5 text-gray-300'
                    : 'hover:bg-slate-50 text-slate-700',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">👨‍🏫</span>
                <div>
                  <div className="font-bold leading-none">{t('workspace.teacher', { defaultValue: 'Müəllim kabineti' })}</div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">Teacher dashboard</div>
                </div>
              </div>
              {isTeacher && <span className="text-xs font-bold text-blue-500">✓</span>}
            </button>

            {/* Mentor */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSwitch('mentor', '/instructor')}
              className={[
                'w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs font-semibold transition-colors',
                isMentor
                  ? isDark
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'bg-purple-50 text-purple-800'
                  : isDark
                    ? 'hover:bg-white/5 text-gray-300'
                    : 'hover:bg-slate-50 text-slate-700',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🧭</span>
                <div>
                  <div className="font-bold leading-none">{t('workspace.mentor', { defaultValue: 'Mentor kabineti' })}</div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">Mentor dashboard</div>
                </div>
              </div>
              {isMentor ? (
                <span className="text-xs font-bold text-purple-500">✓</span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-semibold">
                  Aktivləşdir
                </span>
              )}
            </button>

            {/* Partner */}
            <Link
              to="/partner/dashboard"
              onClick={() => setIsOpen(false)}
              className={[
                'w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs font-semibold transition-colors',
                isDark
                  ? 'hover:bg-white/5 text-gray-300'
                  : 'hover:bg-slate-50 text-slate-700',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🤝</span>
                <div>
                  <div className="font-bold leading-none">{t('nav.partnerCabinet', { defaultValue: 'Partner kabineti' })}</div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">Partner dashboard</div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
