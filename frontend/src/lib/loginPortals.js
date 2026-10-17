/**
 * Sign-in portals. Presentation only: which roles an account may open is decided by the server
 * (backend services/portalAccess.js). `cabinetPath` mirrors the server's redirect for links and fallbacks.
 */
import { isInviteResumePath } from './inviteReturn'

export const LOGIN_PORTALS = Object.freeze({
  student: {
    id: 'student',
    path: '/login/student',
    cabinetPath: '/student',
    icon: 'students',
    titleKey: 'auth.portals.student.title',
    title: 'Tələbə kabinetinə giriş',
    subtitleKey: 'auth.portals.student.subtitle',
    subtitle: 'İmtahanlarınız, tapşırıqlarınız, materiallarınız və nəticələriniz.',
    cardKey: 'auth.portals.student.card',
    card: 'Tələbə',
    passwordAlways: false,
    accent: {
      chip: 'bg-emerald-100 text-emerald-700',
      chipDark: 'bg-emerald-500/15 text-emerald-300',
      bar: 'bg-emerald-500',
      ring: 'hover:border-emerald-400',
    },
  },
  instructor: {
    id: 'instructor',
    path: '/login/instructor',
    cabinetPath: '/instructor',
    icon: 'instructors',
    titleKey: 'auth.portals.instructor.title',
    title: 'Təlimçi kabinetinə giriş',
    subtitleKey: 'auth.portals.instructor.subtitle',
    subtitle: 'Qruplarınız, sual bankınız, imtahanlarınız və canlı dərsləriniz.',
    cardKey: 'auth.portals.instructor.card',
    card: 'Təlimçi',
    passwordAlways: false,
    accent: {
      chip: 'bg-blue-100 text-blue-700',
      chipDark: 'bg-blue-500/15 text-blue-300',
      bar: 'bg-blue-500',
      ring: 'hover:border-blue-400',
    },
  },
  organization: {
    id: 'organization',
    path: '/login/organization',
    cabinetPath: '/org',
    icon: 'building',
    titleKey: 'auth.portals.organization.title',
    title: 'Təşkilat kabinetinə giriş',
    subtitleKey: 'auth.portals.organization.subtitle',
    subtitle: 'Təşkilatın üzvləri, müəllimləri, qrupları və hesabatları.',
    cardKey: 'auth.portals.organization.card',
    card: 'Təşkilat',
    passwordAlways: false,
    accent: {
      chip: 'bg-violet-100 text-violet-700',
      chipDark: 'bg-violet-500/15 text-violet-300',
      bar: 'bg-violet-500',
      ring: 'hover:border-violet-400',
    },
  },
  admin: {
    id: 'admin',
    path: '/login/admin',
    cabinetPath: '/admin',
    icon: 'shield',
    titleKey: 'auth.portals.admin.title',
    title: 'Admin panelinə giriş',
    subtitleKey: 'auth.portals.admin.subtitle',
    subtitle: 'Platformanın idarəetməsi yalnız admin hesabları üçündür.',
    cardKey: 'auth.portals.admin.card',
    card: 'Admin',
    passwordAlways: true,
    accent: {
      chip: 'bg-slate-200 text-slate-800',
      chipDark: 'bg-white/10 text-gray-200',
      bar: 'bg-slate-700',
      ring: 'hover:border-slate-500',
    },
  },
})

export const LOGIN_PORTAL_ORDER = Object.freeze(['student', 'instructor', 'organization', 'admin'])

/**
 * Where to go after a successful portal sign-in: a safe `next` inside the same cabinet (or an invite page
 * for students), otherwise the cabinet the server returned.
 */
export function portalLandingPath(portal, { serverRedirect, next, stored } = {}) {
  const cabinet = serverRedirect || portal.cabinetPath
  const pick = (raw) => {
    const p = String(raw || '').trim()
    if (!p.startsWith('/') || p.startsWith('//')) return null
    const bare = p.split(/[?#]/)[0]
    if (bare === cabinet || bare.startsWith(`${cabinet}/`)) return p
    if (portal.id === 'student' && isInviteResumePath(p)) return p
    return null
  }
  return pick(next) || pick(stored) || cabinet
}
