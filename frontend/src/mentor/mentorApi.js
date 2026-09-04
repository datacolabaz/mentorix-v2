import api from '../lib/api'

export function fetchOnboarding() {
  return api.get('/mentor/onboarding')
}

export function saveOnboarding(payload) {
  return api.patch('/mentor/onboarding', payload)
}

export function askMentor(payload) {
  return api.post('/mentor/ask', payload)
}
