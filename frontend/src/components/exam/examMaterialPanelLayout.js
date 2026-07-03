/** @typedef {'mobile' | 'tablet' | 'desktop'} PanelMode */

export const PANEL_STORAGE_KEY = 'mx_exam_material_panel_v1'
export const ANSWER_MIN_WIDTH = 280
export const PANEL_MIN_WIDTH = 320

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

export function clampPanelSize(width, viewportWidth) {
  const max = maxPanelWidth(viewportWidth)
  return Math.max(PANEL_MIN_WIDTH, Math.min(Math.round(width), max))
}

/** @param {PanelMode} mode */
export function defaultPanelGeometry(mode, viewportWidth, viewportHeight) {
  const vw = Math.max(0, Number(viewportWidth) || 0)
  const vh = Math.max(0, Number(viewportHeight) || 0)
  const widthPct = mode === 'tablet' ? 0.55 : 0.45
  const width = clampPanelSize(Math.round(vw * widthPct), vw)
  const topOffset = Math.min(88, Math.max(56, Math.round(vh * 0.08)))
  const height = Math.max(240, vh - topOffset - 12)
  return { x: 0, y: topOffset, width, height }
}

export function clampPanelToViewport({ x, y, width, height }, viewportWidth, viewportHeight) {
  const vw = Math.max(0, Number(viewportWidth) || 0)
  const vh = Math.max(0, Number(viewportHeight) || 0)
  const w = clampPanelSize(width, vw)
  const h = Math.max(200, Math.min(Math.round(height), vh))
  const maxX = Math.max(0, vw - w)
  const maxY = Math.max(0, vh - h)
  return {
    x: Math.min(Math.max(Math.round(x), 0), maxX),
    y: Math.min(Math.max(Math.round(y), 0), maxY),
    width: w,
    height: Math.min(h, vh - Math.min(Math.max(Math.round(y), 0), maxY)),
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
    if (!Number.isFinite(parsed.width) || !Number.isFinite(parsed.height)) return null
    return clampPanelToViewport(parsed, window.innerWidth, window.innerHeight)
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
        height: panel.height,
      }),
    )
  } catch {
    /* ignore quota */
  }
}

export function applySnapToLeft(panel, mode, viewportHeight) {
  const threshold = snapThresholdForMode(mode)
  if (panel.x > threshold) return panel
  const vh = Math.max(0, Number(viewportHeight) || 0)
  return {
    ...panel,
    x: 0,
    y: 0,
    height: vh,
  }
}
