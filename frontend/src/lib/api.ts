import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('prestamos-token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  res => res,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('prestamos-token')
      localStorage.removeItem('prestamos-user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

export const authAPI = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) => api.post('/auth/register', { name, email, password }),
  me: () => api.get('/auth/me'),
  changePassword: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) => api.post('/auth/change-password', data),
}

export const dashboardAPI = {
  summary: () => api.get('/dashboard/summary'),
}

export const currenciesAPI = {
  list: () => api.get('/currencies'),
  updateRates: () => api.post('/currencies/update-rates'),
  convert: (amount: number, fromCurrency: string) => api.post('/currencies/convert', { amount, fromCurrency }),
}

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
  list: (params?: { category?: string; company?: number; from?: string; to?: string; search?: string; limit?: number }) => api.get('/gastos', { params }),
  summary: (months?: number) => api.get('/gastos/summary', { params: { months } }),
  reports: (params?: { from?: string; to?: string; months?: number }) => api.get('/gastos/reports', { params }),
  create: (data: ExpensePayload) => api.post('/gastos', data),
  update: (id: number, data: Partial<ExpensePayload>) => api.put(`/gastos/${id}`, data),
  delete: (id: number) => api.delete(`/gastos/${id}`),
  categories: () => api.get('/gastos/categories'),
  createCategory: (data: { name: string; icon?: string; color?: string }) => api.post('/gastos/categories', data),
  updateCategory: (id: number, data: { name?: string; icon?: string; color?: string }) => api.put(`/gastos/categories/${id}`, data),
  deleteCategory: (id: number) => api.delete(`/gastos/categories/${id}`),
  companies: () => api.get('/gastos/companies'),
  createCompany: (data: { name: string; description?: string; color?: string }) => api.post('/gastos/companies', data),
  updateCompany: (id: number, data: { name?: string; description?: string; color?: string }) => api.put(`/gastos/companies/${id}`, data),
  deleteCompany: (id: number) => api.delete(`/gastos/companies/${id}`),
}

export interface ClientPayload {
  name: string
  document?: string
  phone?: string
  alternate_phone?: string
  address?: string
  reference_name?: string
  reference_phone?: string
  notes?: string
  status?: 'active' | 'inactive'
}

export const clientesAPI = {
  list: (params?: { search?: string; status?: 'all' | 'active' | 'inactive'; limit?: number; offset?: number }) => api.get('/clientes', { params }),
  detail: (id: number) => api.get(`/clientes/${id}`),
  create: (data: ClientPayload) => api.post('/clientes', data),
  update: (id: number, data: Partial<ClientPayload>) => api.put(`/clientes/${id}`, data),
  deactivate: (id: number) => api.delete(`/clientes/${id}`),
}

export interface LoanPayload {
  client_id: number
  currency_id?: number
  principal_amount: number
  interest_rate?: number
  installments_count: number
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
  start_date?: string
  first_due_date?: string
  late_fee_rate?: number
  notes?: string
}

export const prestamosAPI = {
  list: (params?: { search?: string; status?: 'all' | 'active' | 'paid' | 'cancelled'; limit?: number; offset?: number }) => api.get('/prestamos', { params }),
  detail: (id: number) => api.get(`/prestamos/${id}`),
  create: (data: LoanPayload) => api.post('/prestamos', data),
  pay: (id: number, data: { installment_id?: number; amount: number; payment_date?: string; method?: string; notes?: string }) => api.post(`/prestamos/${id}/payments`, data),
  cancel: (id: number) => api.delete(`/prestamos/${id}`),
  edit: (id: number, data: Partial<LoanPayload>) => api.put(`/prestamos/${id}`, data),
  renew: (id: number) => api.post(`/prestamos/${id}/renew`),
  deleteHard: (id: number) => api.delete(`/prestamos/${id}/hard`),
  payTotal: (id: number, data?: { payment_date?: string; method?: string; notes?: string }) => api.post(`/prestamos/${id}/pay-total`, data || {}),
}

export const filesAPI = {
  upload: (expenseId: number, files: File[]) => {
    const formData = new FormData()
    files.forEach(f => formData.append('attachments', f))
    return api.post(`/files/expense/${expenseId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  list: (expenseId: number) => api.get(`/files/expense/${expenseId}`),
  downloadUrl: (fileId: number) => {
    const token = localStorage.getItem('prestamos-token') || ''
    return `/api/files/download/${fileId}?token=${encodeURIComponent(token)}`
  },
  delete: (fileId: number) => api.delete(`/files/${fileId}`),
}

export const ahorrosAPI = {
  boxes: () => api.get('/ahorros/boxes'),
  boxDetail: (id: number) => api.get(`/ahorros/boxes/${id}`),
  createBox: (data: { name: string; bank_id: number; goal?: number; balance?: number }) => api.post('/ahorros/boxes', data),
  updateBox: (id: number, data: { name?: string; bank_id?: number; goal?: number }) => api.put(`/ahorros/boxes/${id}`, data),
  deleteBox: (id: number) => api.delete(`/ahorros/boxes/${id}`),
  addMovement: (boxId: number, data: { type: string; amount: number; description?: string; date?: string }) => api.post(`/ahorros/boxes/${boxId}/movements`, data),
  projection: (id: number, params?: { months?: number; monthly_deposit?: number }) => api.get(`/ahorros/boxes/${id}/projection`, { params }),
  changeRate: (id: number, new_rate: number) => api.put(`/ahorros/boxes/${id}/rate`, { new_rate }),
  banks: () => api.get('/ahorros/banks'),
  createBank: (data: { name: string; rate_ea: number }) => api.post('/ahorros/banks', data),
  updateBank: (id: number, data: { name?: string; rate_ea?: number }) => api.put(`/ahorros/banks/${id}`, data),
  deleteBank: (id: number) => api.delete(`/ahorros/banks/${id}`),
  summary: () => api.get('/ahorros/summary'),
}

export const notificationsAPI = {
  getSettings: () => api.get('/notifications/settings'),
  updateSettings: (data: {
    email_enabled?: boolean; email_address?: string;
    telegram_enabled?: boolean; telegram_chat_id?: string;
    whatsapp_enabled?: boolean;
    notify_days_before?: number;
    credit_card_notify_days_before?: number;
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
