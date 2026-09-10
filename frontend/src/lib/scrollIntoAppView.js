/** IDs for “add a subject” deep-links from the discover-profile modal. */
export const DISCOVER_PROFILE_SECTION_ID = 'discover-profile'
export const DISCOVER_SUBJECT_INPUT_ID = 'discover-subject-input'
export const DISCOVER_MAP_SUBJECT_INPUT_ID = 'discover-map-subject-input'

export function findScrollParent(el) {
  let p = el?.parentElement
  while (p && p !== document.body && p !== document.documentElement) {
    const style = window.getComputedStyle(p)
    const oy = style.overflowY
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && p.scrollHeight > p.clientHeight + 1) {
      return p
    }
    p = p.parentElement
  }
  return document.scrollingElement || document.documentElement
}

export function scrollElementIntoAppView(el, { behavior = 'smooth', offset = 16, focus = false } = {}) {
  if (!el) return false
  const scroller = findScrollParent(el)
  const elRect = el.getBoundingClientRect()
  const isWindow =
    scroller === document.documentElement ||
    scroller === document.body ||
    scroller === document.scrollingElement
  const scRect = isWindow ? { top: 0 } : scroller.getBoundingClientRect()
  const currentTop = isWindow ? window.scrollY || document.documentElement.scrollTop || 0 : scroller.scrollTop
  const nextTop = Math.max(0, currentTop + (elRect.top - scRect.top) - offset)
  if (isWindow) {
    window.scrollTo({ top: nextTop, behavior })
  } else {
    scroller.scrollTo({ top: nextTop, behavior })
  }
  if (focus) {
    const field = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
      ? el
      : typeof el.querySelector === 'function'
        ? el.querySelector('input, textarea, select')
        : null
    if (field && typeof field.focus === 'function') {
      try {
        field.focus({ preventScroll: true })
      } catch {
        field.focus()
      }
    }
  }
  return true
}

export function resolveScrollTarget(id) {
  const requested = String(id || '').trim()
  if (!requested) return null
  if (requested === DISCOVER_SUBJECT_INPUT_ID) {
    return (
      document.getElementById(DISCOVER_SUBJECT_INPUT_ID) ||
      document.getElementById(DISCOVER_MAP_SUBJECT_INPUT_ID) ||
      document.getElementById(DISCOVER_PROFILE_SECTION_ID)
    )
  }
  return document.getElementById(requested)
}

/**
 * Wait for a settings section (or subject input) to mount, then scroll the
 * instructor panel — not the window — and focus the field when it is an input.
 */
export function scheduleScrollToId(id, { attempts = 24, delayMs = 80, focus = true, offset = 16 } = {}) {
  const timers = []
  let n = 0
  const run = (behavior) => {
    const el = resolveScrollTarget(id)
    if (!el) return false
    const isField = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
    scrollElementIntoAppView(el, { behavior, offset, focus: focus && (isField || Boolean(el.querySelector)) })
    return true
  }
  const tick = () => {
    if (run(n < 2 ? 'auto' : 'smooth')) {
      timers.push(window.setTimeout(() => run('smooth'), 320))
      return
    }
    n += 1
    if (n < attempts) timers.push(window.setTimeout(tick, delayMs))
  }
  timers.push(window.setTimeout(tick, 40))
  return () => timers.forEach((t) => window.clearTimeout(t))
}
