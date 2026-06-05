import { sendTelegramMessage } from './telegramService'
import { sendWhatsAppMessage } from './whatsperService'

export interface CreditCardReport {
  userName: string
  generatedAt: string
  totalDebt: number
  totalLimit: number
  availableLimit: number
  cards: Array<{
    name: string
    bank_name: string
    last_four?: string | null
    pending_balance: number
    credit_limit: number
    cut_day: number
    payment_due_day: number
    currency_code: string
  }>
  upcoming: Array<{
    description: string
    card_name: string
    installment_number: number
    due_date: string
    remaining_amount: number
  }>
}

export async function sendTelegramCreditCardReport(chatId: string, report: CreditCardReport): Promise<any> {
  return sendTelegramMessage(chatId, formatCreditCardReportHtml(report))
}

export async function sendWhatsAppCreditCardReport(report: CreditCardReport) {
  return sendWhatsAppMessage(formatCreditCardReportText(report))
}

function formatCreditCardReportText(report: CreditCardReport) {
  const cards = report.cards.length
    ? report.cards.slice(0, 8).map(card => {
      const suffix = card.last_four ? ` ***${card.last_four}` : ''
      const available = Number(card.credit_limit || 0) - Number(card.pending_balance || 0)
      return [
        `💳 ${card.name}${suffix}`,
        `Banco: ${card.bank_name} | Moneda: ${card.currency_code}`,
        `Saldo: ${formatCOP(card.pending_balance)} | Disponible: ${formatCOP(available)}`,
        `Corte/pago: ${card.cut_day}/${card.payment_due_day}`,
      ].join('\n')
    }).join('\n\n')
    : 'Sin tarjetas registradas'

  const upcoming = report.upcoming.length
    ? report.upcoming.slice(0, 8).map(item =>
      `• ${item.description} — ${item.card_name} cuota ${item.installment_number}\n` +
        `Vence: ${item.due_date} | ${formatCOP(item.remaining_amount)}`
    ).join('\n')
    : 'Sin cuotas próximas'

  return [
    '💳 Prestamos — Reporte de tarjetas',
    '',
    `👤 Usuario: ${report.userName}`,
    `🕒 Generado: ${report.generatedAt}`,
    '',
    `💰 Deuda estimada: ${formatCOP(report.totalDebt)}`,
    `🏦 Cupo total: ${formatCOP(report.totalLimit)}`,
    `✅ Cupo disponible: ${formatCOP(report.availableLimit)}`,
    '',
    'Tarjetas:',
    cards,
    '',
    'Próximas cuotas:',
    upcoming,
  ].join('\n')
}

function formatCreditCardReportHtml(report: CreditCardReport) {
  const cards = report.cards.length
    ? report.cards.slice(0, 8).map(card => {
      const suffix = card.last_four ? ` ***${escapeHtml(card.last_four)}` : ''
      const available = Number(card.credit_limit || 0) - Number(card.pending_balance || 0)
      return `💳 <b>${escapeHtml(card.name)}${suffix}</b>\n` +
        `Banco: ${escapeHtml(card.bank_name)} | Moneda: ${escapeHtml(card.currency_code)}\n` +
        `Saldo: ${formatCOP(card.pending_balance)} | Disponible: ${formatCOP(available)}\n` +
        `Corte/pago: ${card.cut_day}/${card.payment_due_day}`
    }).join('\n\n')
    : 'Sin tarjetas registradas'

  const upcoming = report.upcoming.length
    ? report.upcoming.slice(0, 8).map(item =>
      `• ${escapeHtml(item.description)} — ${escapeHtml(item.card_name)} cuota ${item.installment_number}\n` +
        `Vence: ${escapeHtml(item.due_date)} | ${formatCOP(item.remaining_amount)}`
    ).join('\n')
    : 'Sin cuotas próximas'

  return `💳 <b>Prestamos — Reporte de tarjetas</b>\n\n` +
    `👤 <b>Usuario:</b> ${escapeHtml(report.userName)}\n` +
    `🕒 <b>Generado:</b> ${escapeHtml(report.generatedAt)}\n\n` +
    `💰 <b>Deuda estimada:</b> ${formatCOP(report.totalDebt)}\n` +
    `🏦 <b>Cupo total:</b> ${formatCOP(report.totalLimit)}\n` +
    `✅ <b>Cupo disponible:</b> ${formatCOP(report.availableLimit)}\n\n` +
    `<b>Tarjetas:</b>\n${cards}\n\n` +
    `<b>Próximas cuotas:</b>\n${upcoming}`
}

function formatCOP(value: number) {
  return '$' + Math.round(value || 0).toLocaleString('es-CO')
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}