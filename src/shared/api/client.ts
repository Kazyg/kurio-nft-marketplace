import axios from 'axios'
import { env } from '@/shared/config/env'
import { getAccessToken, getGuestId, clearAccessToken } from './identity'
export const api = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  timeout: 10_000,
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  config.headers.set('X-Guest-Id', getGuestId())
  return config
})

api.interceptors.response.use(undefined, (error: unknown) => {
  if (
    axios.isAxiosError(error) &&
    error.response?.status === 401 &&
    !/\/auth\/(login|register|social)$/.test(error.config?.url ?? '') &&
    error.config?.headers.get('Authorization') ===
      `Bearer ${getAccessToken()}` &&
    getAccessToken()
  ) {
    clearAccessToken()
    window.dispatchEvent(new Event('kurio:session-expired'))
  }
  return Promise.reject(error)
})
