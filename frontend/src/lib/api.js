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

/** Giriş cəhdində köhnə Bearer token göndərmə (bəzi proxy/middleware qarışıqlığı) */
function isPublicAuthPath(url) {
  const path = requestPath(url)
  return (
    path.includes('/auth/login') ||
    path.includes('/auth/register') ||
    path.includes('/auth/otp/') ||
    path.includes('/auth/pin/') ||
    path.includes('/auth/phone/')
  )
}

api.interceptors.request.use((config) => {
  const token = isPublicAuthPath(config.url || '') ? null : localStorage.getItem('mx_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  else delete config.headers.Authorization
  return config
})

function isAuthAttemptUrl(url) {
  if (!url || typeof url !== 'string') return false
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/otp/') ||
    url.includes('/auth/pin/') ||
    url.includes('/auth/phone/') ||
    url.includes('/auth/me')
  )
}

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const url = err.config?.url || ''
    if (err.response?.status === 401 && !isAuthAttemptUrl(url)) {
      localStorage.removeItem('mx_token')
      localStorage.removeItem('mx_user')
      window.location.href = '/login'
    }
    const data = err.response?.data
    const msg = data?.message || err.message || 'Xəta'
    const wrapped = data && typeof data === 'object' ? { ...data, message: msg } : { message: msg }
    return Promise.reject(wrapped)
  }
)

export default api
