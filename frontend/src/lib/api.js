import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mx_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

function isAuthAttemptUrl(url) {
  if (!url || typeof url !== 'string') return false
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/otp/') ||
    url.includes('/auth/pin/') ||
    url.includes('/auth/phone/')
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
