import axios from 'axios'

const SEND_URL = process.env.WHATSPER_API_URL || 'https://api.whatsper.co/send'
const STATUS_URL = process.env.WHATSPER_STATUS_URL || 'https://api.whatsper.co/sessions/status'

function getConfig() {
  return {
    sendUrl: SEND_URL,
    statusUrl: STATUS_URL,
    token: process.env.WHATSPER_API_TOKEN,
    session: process.env.WHATSPER_SESSION_ID,
    to: process.env.WHATSPER_TO,
  }
}

export function getWhatsAppConfigStatus() {
  const config = getConfig()
  return {
    configured: Boolean(config.token && config.session && config.to),
    tokenConfigured: Boolean(config.token),
    sessionConfigured: Boolean(config.session),
    toConfigured: Boolean(config.to),
    to: config.to ? maskValue(config.to) : null,
  }
}

export async function getWhatsAppSessionStatus() {
  const config = getConfig()

  if (!config.token || !config.session) {
    throw new Error('WhatsApp no configurado. Revisa WHATSPER_API_TOKEN y WHATSPER_SESSION_ID en el .env')
  }

  const response = await axios.get(config.statusUrl, {
    params: {
      token: config.token,
      session: config.session,
    },
    timeout: 15000,
  })

  return response.data
}

export async function sendWhatsAppMessage(content: string, toOverride?: string) {
  const config = getConfig()
  const to = toOverride || config.to

  if (!config.token || !config.session || !to) {
    throw new Error('WhatsApp no configurado. Revisa WHATSPER_API_TOKEN, WHATSPER_SESSION_ID y WHATSPER_TO en el .env')
  }

  const response = await axios.post(
    config.sendUrl,
    {
      session: config.session,
      type: 'text',
      to,
      content,
    },
    {
      params: { token: config.token },
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    },
  )

  return response.data
}

export async function sendTestWhatsAppMessage() {
  const timestamp = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
  return sendWhatsAppMessage(`✅ RobertApp: WhatsApp configurado correctamente.\n\nFecha: ${timestamp}`)
}

export async function sendWhatsAppFinanceReport(report: WhatsAppFinanceReport) {
  return sendWhatsAppMessage(formatFinanceReport(report))
}

export interface WhatsAppFinanceReport {
  userName: string
  generatedAt: string
  todayExpensesCOP: number
  monthExpensesCOP: number
  monthExpensesCount: number
  savingsBalanceCOP: number
  savingsBoxesCount: number
  upcomingRecurringCount: number
  upcomingRecurringTotalCOP: number
  topCategoryName?: string | null
  topCategoryTotalCOP?: number | null
}

function formatFinanceReport(report: WhatsAppFinanceReport) {
  const topCategory = report.topCategoryName
    ? `${report.topCategoryName}: ${formatCOP(report.topCategoryTotalCOP || 0)}`
    : 'Sin datos'

  return [
    '📊 RobertApp — Reporte financiero',
    '',
    `👤 Usuario: ${report.userName}`,
    `🕒 Generado: ${report.generatedAt}`,
    '',
    `💸 Gastos de hoy: ${formatCOP(report.todayExpensesCOP)}`,
    `📅 Gastos del mes: ${formatCOP(report.monthExpensesCOP)} (${report.monthExpensesCount})`,
    `🏷️ Categoría principal: ${topCategory}`,
    '',
    `🏦 Ahorros actuales: ${formatCOP(report.savingsBalanceCOP)} en ${report.savingsBoxesCount} cajita(s)`,
    `⚠️ Recurrentes próximos: ${report.upcomingRecurringCount} por ${formatCOP(report.upcomingRecurringTotalCOP)}`,
  ].join('\n')
}

function formatCOP(value: number) {
  return '$' + Math.round(value || 0).toLocaleString('es-CO')
}

function maskValue(value: string) {
  if (value.length <= 4) return '****'
  return `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`
}
