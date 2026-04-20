import axios from 'axios'

const parsedTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  // Railway/soyuq başlanğıc + DB bəzən 15s-dən çox çəkir
  timeout: Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 60000,
})

function requestPath(url) {
  if (!url || typeof url !== 'string') return ''
  if (url.includes('://')) {
    try {
      return new URL(url).pathname
    } catch {
      return url
    }
  }
  return url
}

/** baseURL + url (məs. /api + auth/login) → tam pathname; axios bəzən url-də / olmur */
function combinedPath(config) {
  const url = config?.url || ''
  const base = (config?.baseURL || '').replace(/\/+$/, '')
  if (url.includes('://')) {
    try {
      return new URL(url).pathname
    } catch {
      return url
    }
  }
  const rel = String(url).replace(/^\/+/, '')
  const merged = base ? `${base}/${rel}` : `/${rel}`
  return merged.replace(/\/+/g, '/')
}

/** Giriş cəhdində köhnə Bearer token göndərmə (bəzi proxy/middleware qarışıqlığı) */
function isPublicAuthPath(config) {
  const path = combinedPath(config)
  return (
    path.includes('/auth/login') ||
    path.includes('/auth/otp/') ||
    path.includes('/auth/pin/') ||
    path.includes('/auth/phone/')
  )
}

api.interceptors.request.use((config) => {
  const token = isPublicAuthPath(config) ? null : localStorage.getItem('mx_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  else delete config.headers.Authorization
  return config
})

function isAuthAttemptConfig(config) {
  if (!config) return false
  const path = combinedPath(config)
  return (
    path.includes('/auth/login') ||
    path.includes('/auth/otp/') ||
    path.includes('/auth/pin/') ||
    path.includes('/auth/phone/') ||
    path.includes('/auth/me') ||
    path.includes('/exams/material-file') ||
    path.includes('/exams/by-exam/')
  )
}

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401 && !isAuthAttemptConfig(err.config)) {
      localStorage.removeItem('mx_token')
      localStorage.removeItem('mx_user')
      window.location.href = '/login'
    }
    const data = err.response?.data
    const status = err.response?.status
    const msg = data?.message || err.message || 'Xəta'
    const wrapped =
      data && typeof data === 'object'
        ? { ...data, message: msg, status }
        : { message: msg, status }
    return Promise.reject(wrapped)
  }
)

export default api
