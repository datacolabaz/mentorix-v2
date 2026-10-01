import api from '../lib/api'

export function fetchOnboarding() {
  return api.get('/assistant/onboarding')
}

export function saveOnboarding(payload) {
  return api.patch('/assistant/onboarding', payload)
}

export function askAssistant(payload) {
  return api.post('/assistant/ask', payload)
}
