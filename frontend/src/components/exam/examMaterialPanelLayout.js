/** @typedef {'mobile' | 'tablet' | 'desktop'} PanelMode */

export const PANEL_STORAGE_KEY = 'mx_exam_material_panel_v1'
export const ANSWER_MIN_WIDTH = 280
export const PANEL_MIN_WIDTH = 320
export const PANEL_MIN_HEIGHT = 180
/** PDF/şəkil sahəsinin maksimum hündürlüyü (scroll daxilində) */
export const PANEL_CONTENT_MAX_HEIGHT = 720

/** @returns {PanelMode} */
export function getPanelMode(width = typeof window !== 'undefined' ? window.innerWidth : 1024) {
  if (width < 768) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

export function snapThresholdForMode(mode) {
  return mode === 'tablet' ? 56 : 30
}

export function maxPanelWidth(viewportWidth) {
  const vw = Math.max(0, Number(viewportWidth) || 0)
  return Math.max(PANEL_MIN_WIDTH, Math.min(Math.round(vw * 0.9), vw - ANSWER_MIN_WIDTH - 16))
}

export function maxContentHeight(viewportHeight, chromeHeight = 120) {
  const vh = Math.max(0, Number(viewportHeight) || 0)
  return Math.max(160, Math.min(PANEL_CONTENT_MAX_HEIGHT, vh - chromeHeight - 24))
}

export function clampPanelSize(width, viewportWidth) {
  const max = maxPanelWidth(viewportWidth)
  return Math.max(PANEL_MIN_WIDTH, Math.min(Math.round(width), max))
}

export function estimatePdfContentHeight(panelWidth) {
  const w = Math.max(PANEL_MIN_WIDTH, Number(panelWidth) || PANEL_MIN_WIDTH)
  return Math.min(Math.round(w * 1.35), PANEL_CONTENT_MAX_HEIGHT)
}

/** Başlanğıc ölçü — hündürlük sonradan məzmunla yenilənir */
export function defaultPanelGeometry(mode, viewportWidth, viewportHeight, contentHeight = null) {
  const vw = Math.max(0, Number(viewportWidth) || 0)
  const vh = Math.max(0, Number(viewportHeight) || 0)
  const widthPct = mode === 'tablet' ? 0.55 : 0.45
  const width = clampPanelSize(Math.round(vw * widthPct), vw)
  const topOffset = Math.min(88, Math.max(56, Math.round(vh * 0.08)))
  const content = contentHeight ?? estimatePdfContentHeight(width)
  const height = Math.max(PANEL_MIN_HEIGHT, Math.min(Math.round(120 + content), vh - topOffset - 8))
  return { x: 0, y: topOffset, width, height }
}

export function clampPanelToViewport({ x, y, width, height }, viewportWidth, viewportHeight) {
  const vw = Math.max(0, Number(viewportWidth) || 0)
  const vh = Math.max(0, Number(viewportHeight) || 0)
  const w = clampPanelSize(width, vw)
  const h = Math.max(PANEL_MIN_HEIGHT, Math.min(Math.round(height), vh))
  const maxX = Math.max(0, vw - w)
  const maxY = Math.max(0, vh - h)
  const clampedY = Math.min(Math.max(Math.round(y), 0), maxY)
  return {
    x: Math.min(Math.max(Math.round(x), 0), maxX),
    y: clampedY,
    width: w,
    height: Math.min(h, vh - clampedY),
  }
}

/** @param {PanelMode} mode */
export function loadStoredPanel(mode) {
  try {
    const raw = sessionStorage.getItem(PANEL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.mode !== mode) return null
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null
    if (!Number.isFinite(parsed.width)) return null
    const geometry = {
      x: parsed.x,
      y: parsed.y,
      width: parsed.width,
      height: defaultPanelGeometry(mode, window.innerWidth, window.innerHeight).height,
    }
    return clampPanelToViewport(geometry, window.innerWidth, window.innerHeight)
  } catch {
    return null
  }
}

/** @param {PanelMode} mode */
export function saveStoredPanel(mode, panel) {
  try {
    sessionStorage.setItem(
      PANEL_STORAGE_KEY,
      JSON.stringify({
        mode,
        x: panel.x,
        y: panel.y,
        width: panel.width,
      }),
    )
  } catch {
    /* ignore quota */
  }
}

/** Sol divara yapış — eni/hündürlüyü məzmun ölçüsünə uyğun saxla, tam ekrana uzatma */
export function applySnapToLeft(panel, mode) {
  const threshold = snapThresholdForMode(mode)
  if (panel.x > threshold) return panel
  return {
    ...panel,
    x: 0,
    y: Math.max(0, Math.round(panel.y)),
  }
}

export function totalPanelHeight(chromeHeight, contentHeight, viewportHeight, panelY = 0) {
  const vh = Math.max(0, Number(viewportHeight) || 0)
  const y = Math.max(0, Number(panelY) || 0)
  const total = Math.round(chromeHeight + contentHeight)
  return Math.max(PANEL_MIN_HEIGHT, Math.min(total, vh - y))
}
