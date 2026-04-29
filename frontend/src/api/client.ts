import axios from 'axios'
import toast from 'react-hot-toast'
import { clearAllCache } from './cache'

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000, // 15 сек — если сервер не ответил, считаем что висит
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let timeoutToastShown = false

api.interceptors.response.use(
  (res) => {
    timeoutToastShown = false
    return res
  },
  (err) => {
    // Таймаут — единичный тост, чтобы не спамить
    if (err.code === 'ECONNABORTED' && !timeoutToastShown) {
      timeoutToastShown = true
      toast.error('Сервер не отвечает, попробуйте обновить страницу')
      setTimeout(() => { timeoutToastShown = false }, 5000)
    }
    if (err.response?.status === 401) {
      // Чистим всё — токен, пользователя, кэш
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('client')
      clearAllCache()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
