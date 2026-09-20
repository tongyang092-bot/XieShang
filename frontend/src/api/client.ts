import axios from 'axios'

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : window.location.origin)

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 120000,
})
