export const FEATURE_FLAGS = Object.freeze({
  UNIVERSITY_SEARCH: 'feature.university_search.enabled',
  MARKETPLACE: 'feature.marketplace.enabled',
  MENTOR_SERVICES: 'feature.mentor_services.enabled',
  LIVE_ROOM: 'feature.live_room.enabled',
  EXAM_RESULT_MODES: 'feature.exam_result_modes.enabled',
  PROCTORING: 'feature.proctoring.enabled',
})

/** Backend `constants/featureFlags.js` ilə eyni olmalıdır. */
export const FEATURE_FLAG_DEFAULTS = Object.freeze({
  [FEATURE_FLAGS.UNIVERSITY_SEARCH]: false,
  [FEATURE_FLAGS.MARKETPLACE]: false,
  [FEATURE_FLAGS.MENTOR_SERVICES]: false,
  [FEATURE_FLAGS.LIVE_ROOM]: false,
  [FEATURE_FLAGS.EXAM_RESULT_MODES]: true,
  [FEATURE_FLAGS.PROCTORING]: false,
})

/** Naviqasiya linki / route prefiksi → onu idarə edən flag. */
const PATH_FEATURES = [
  ['/instructor/university-programs', FEATURE_FLAGS.UNIVERSITY_SEARCH],
  ['/student/universities', FEATURE_FLAGS.UNIVERSITY_SEARCH],
  ['/universities', FEATURE_FLAGS.UNIVERSITY_SEARCH],
  ['/instructor/inquiries', FEATURE_FLAGS.MARKETPLACE],
  ['/account/favorites', FEATURE_FLAGS.MARKETPLACE],
  ['/search', FEATURE_FLAGS.MARKETPLACE],
  ['/instructor/roadmap', FEATURE_FLAGS.MENTOR_SERVICES],
  ['/student/mentorship', FEATURE_FLAGS.MENTOR_SERVICES],
  ['/mentorship', FEATURE_FLAGS.MENTOR_SERVICES],
  ['/live/join', FEATURE_FLAGS.LIVE_ROOM],
]

export function featureForPath(path) {
  const p = String(path || '').split(/[?#]/)[0]
  const hit = PATH_FEATURES.find(([prefix]) => p === prefix || p.startsWith(`${prefix}/`))
  return hit ? hit[1] : null
}

export function isPathEnabled(path, flags) {
  const key = featureForPath(path)
  return !key || flags?.[key] === true
}

/** `{ to }` elementləri olan siyahıdan söndürülmüş funksiyalara aid linkləri çıxarır. */
export function filterNavItemsByFlags(items, flags) {
  return (Array.isArray(items) ? items : []).filter((item) => isPathEnabled(item?.to, flags))
}

export function filterNavSectionsByFlags(sections, flags) {
  return (Array.isArray(sections) ? sections : [])
    .map((section) => ({ ...section, items: filterNavItemsByFlags(section.items, flags) }))
    .filter((section) => section.items.length > 0)
}
