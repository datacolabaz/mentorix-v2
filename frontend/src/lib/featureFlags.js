import { useEffect, useSyncExternalStore } from 'react'
import api from './api'
import { FEATURE_FLAG_DEFAULTS } from './featureFlagPaths'

export {
  FEATURE_FLAGS,
  FEATURE_FLAG_DEFAULTS,
  featureForPath,
  isPathEnabled,
  filterNavItemsByFlags,
  filterNavSectionsByFlags,
} from './featureFlagPaths'

let state = { flags: { ...FEATURE_FLAG_DEFAULTS }, loaded: false }
let inflight = null
const listeners = new Set()

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function loadFeatureFlags({ force = false } = {}) {
  if (inflight && !force) return inflight
  inflight = api
    .get('/public/feature-flags')
    .then((data) => {
      const flags = data?.flags && typeof data.flags === 'object' ? data.flags : {}
      state = { flags: { ...FEATURE_FLAG_DEFAULTS, ...flags }, loaded: true }
    })
    .catch(() => {
      state = { ...state, loaded: true }
    })
    .finally(emit)
    .then(() => state.flags)
  return inflight
}

export function setFeatureFlagLocal(key, enabled) {
  state = { ...state, flags: { ...state.flags, [key]: enabled === true } }
  emit()
}

export function isFeatureOn(key) {
  return state.flags[key] === true
}

export function useFeatureFlags() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state)
  useEffect(() => {
    if (!snapshot.loaded) void loadFeatureFlags()
  }, [snapshot.loaded])
  return snapshot
}

export function useFeatureFlag(key) {
  return useFeatureFlags().flags[key] === true
}
