import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

// JWT interceptor — attach token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('robertapp-token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor — handle 401 (expired token)
api.interceptors.response.use(
  res => res,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('robertapp-token')
      localStorage.removeItem('robertapp-user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

// ===== Auth =====
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post('/auth/register', { name, email, password }),
  me: () => api.get('/auth/me'),
  changePassword: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    api.post('/auth/change-password', data),
}

// ===== Dashboard =====
export const dashboardAPI = {
  summary: () => api.get('/dashboard/summary'),
}

// ===== Currencies =====
export const currenciesAPI = {
  list: () => api.get('/currencies'),
  updateRates: () => api.post('/currencies/update-rates'),
  convert: (amount: number, fromCurrency: string) =>
    api.post('/currencies/convert', { amount, fromCurrency }),
}

// ===== Gastos =====
export interface ExpensePayload {
  description: string
  amount: number
  currency_id?: number
  category_id?: number
  company_id?: number
  date?: string
  is_recurring?: boolean
  recurring_frequency?: string
  notes?: string
  custom_exchange_rate?: number
}

export const gastosAPI = {
  list: (params?: { category?: string; company?: number; from?: string; to?: string; search?: string; limit?: number }) =>
    api.get('/gastos', { params }),
  summary: (months?: number) =>
    api.get('/gastos/summary', { params: { months } }),
  reports: (params?: { from?: string; to?: string; months?: number }) =>
    api.get('/gastos/reports', { params }),
  create: (data: ExpensePayload) =>
    api.post('/gastos', data),
  update: (id: number, data: Partial<ExpensePayload>) =>
    api.put(`/gastos/${id}`, data),
  delete: (id: number) =>
    api.delete(`/gastos/${id}`),
  categories: () =>
    api.get('/gastos/categories'),
  createCategory: (data: { name: string; icon?: string; color?: string }) =>
    api.post('/gastos/categories', data),
  updateCategory: (id: number, data: { name?: string; icon?: string; color?: string }) =>
    api.put(`/gastos/categories/${id}`, data),
  deleteCategory: (id: number) =>
    api.delete(`/gastos/categories/${id}`),
  companies: () =>
    api.get('/gastos/companies'),
  createCompany: (data: { name: string; description?: string; color?: string }) =>
    api.post('/gastos/companies', data),
  updateCompany: (id: number, data: { name?: string; description?: string; color?: string }) =>
    api.put(`/gastos/companies/${id}`, data),
  deleteCompany: (id: number) =>
    api.delete(`/gastos/companies/${id}`),
}

// ===== Files =====
export const filesAPI = {
  upload: (expenseId: number, files: File[]) => {
    const formData = new FormData()
    files.forEach(f => formData.append('attachments', f))
    return api.post(`/files/expense/${expenseId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  list: (expenseId: number) =>
    api.get(`/files/expense/${expenseId}`),
  downloadUrl: (fileId: number) => {
    const token = localStorage.getItem('robertapp-token') || ''
    return `/api/files/download/${fileId}?token=${encodeURIComponent(token)}`
  },
  delete: (fileId: number) =>
    api.delete(`/files/${fileId}`),
}

// ===== Ahorros =====
export const ahorrosAPI = {
  boxes: () => api.get('/ahorros/boxes'),
  boxDetail: (id: number) => api.get(`/ahorros/boxes/${id}`),
  createBox: (data: { name: string; bank_id: number; goal?: number; balance?: number }) =>
    api.post('/ahorros/boxes', data),
  updateBox: (id: number, data: { name?: string; bank_id?: number; goal?: number }) =>
    api.put(`/ahorros/boxes/${id}`, data),
  deleteBox: (id: number) =>
    api.delete(`/ahorros/boxes/${id}`),
  addMovement: (boxId: number, data: { type: string; amount: number; description?: string; date?: string }) =>
    api.post(`/ahorros/boxes/${boxId}/movements`, data),
  projection: (id: number, params?: { months?: number; monthly_deposit?: number }) =>
    api.get(`/ahorros/boxes/${id}/projection`, { params }),
  changeRate: (id: number, new_rate: number) =>
    api.put(`/ahorros/boxes/${id}/rate`, { new_rate }),
  banks: () => api.get('/ahorros/banks'),
  createBank: (data: { name: string; rate_ea: number }) =>
    api.post('/ahorros/banks', data),
  updateBank: (id: number, data: { name?: string; rate_ea?: number }) =>
    api.put(`/ahorros/banks/${id}`, data),
  deleteBank: (id: number) =>
    api.delete(`/ahorros/banks/${id}`),
  summary: () => api.get('/ahorros/summary'),
}

// ===== Notifications =====
export const notificationsAPI = {
  getSettings: () => api.get('/notifications/settings'),
  updateSettings: (data: {
    email_enabled?: boolean; email_address?: string;
    telegram_enabled?: boolean; telegram_chat_id?: string;
    notify_days_before?: number
  }) => api.put('/notifications/settings', data),
  sendTest: () => api.post('/notifications/test'),
  testTelegram: () => api.post('/notifications/test-telegram'),
  sendTelegramReport: () => api.post('/notifications/telegram/report'),
  getWhatsAppStatus: () => api.get('/notifications/whatsapp/status'),
  testWhatsApp: () => api.post('/notifications/whatsapp/test'),
  sendWhatsAppReport: () => api.post('/notifications/whatsapp/report'),
  sendSavingsReport: () => api.post('/notifications/send-savings-report'),
  checkDue: () => api.post('/notifications/check-due'),
}
