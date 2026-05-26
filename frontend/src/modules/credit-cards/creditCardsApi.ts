import api from '@/lib/api'

export const creditCardsAPI = {
  summary: () => api.get('/credit-cards/summary'),
  cards: () => api.get('/credit-cards/cards'),
  createCard: (data: any) => api.post('/credit-cards/cards', data),
  updateCard: (id: number, data: any) => api.put(`/credit-cards/cards/${id}`, data),
  charges: () => api.get('/credit-cards/charges'),
  createCharge: (data: any) => api.post('/credit-cards/charges', data),
  installments: () => api.get('/credit-cards/installments'),
  payments: () => api.get('/credit-cards/payments'),
  createPayment: (data: any) => api.post('/credit-cards/payments', data),
}
