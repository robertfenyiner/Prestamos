import https from 'https'
import http from 'http'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''

interface TelegramResponse {
  ok: boolean
  result?: any
  description?: string
}

export interface TelegramFinanceReport {
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

export async function sendTelegramMessage(chatId: string, text: string, parseMode: string = 'HTML'): Promise<TelegramResponse> {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN no configurado en .env')
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
  const body = JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: parseMode,
  })

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data) as TelegramResponse
          if (!parsed.ok) {
            reject(new Error(`Telegram API error: ${parsed.description}`))
          } else {
            resolve(parsed)
          }
        } catch (e) {
          reject(new Error(`Failed to parse Telegram response: ${data}`))
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

export async function sendDailySavingsReport(chatId: string, boxes: any[], totalInterestAllTime: number) {
  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')
  const today = new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  let totalDaily = 0
  let totalBalance = 0
  let lines: string[] = []

  for (const box of boxes) {
    const dailyRate = Math.pow(1 + box.bank_rate / 100, 1 / 365) - 1
    const dailyEarnings = Math.round(box.balance * dailyRate * 100) / 100
    totalDaily += dailyEarnings
    totalBalance += box.balance

    lines.push(
      `💰 <b>${escapeHtml(box.name)}</b>\n` +
      `   +${fmt(dailyEarnings)} hoy | Saldo: ${fmt(box.balance)} | ${box.bank_rate}% EA`
    )
  }

  const message =
    `📊 <b>Resumen Diario de Ahorros</b>\n` +
    `📅 ${today}\n\n` +
    lines.join('\n\n') + '\n\n' +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📈 <b>Ganancia total hoy:</b> +${fmt(totalDaily)}\n` +
    `💎 <b>Total en ahorros:</b> ${fmt(totalBalance)}\n` +
    `🏆 <b>Total interés acumulado:</b> ${fmt(totalInterestAllTime)}`

  return sendTelegramMessage(chatId, message)
}

export async function sendTestTelegramMessage(chatId: string) {
  const message =
    `✅ <b>RobertApp — Conexión exitosa</b>\n\n` +
    `Tu bot de Telegram está correctamente configurado.\n` +
    `Recibirás un resumen diario de las ganancias de tus cajitas de ahorro.\n\n` +
    `🤖 <i>Mensaje enviado desde RobertApp</i>`

  return sendTelegramMessage(chatId, message)
}

export async function sendTelegramFinanceReport(chatId: string, report: TelegramFinanceReport) {
  const topCategory = report.topCategoryName
    ? `${escapeHtml(report.topCategoryName)}: ${formatCOP(report.topCategoryTotalCOP || 0)}`
    : 'Sin datos'

  const message =
    `📊 <b>RobertApp — Reporte financiero</b>\n\n` +
    `👤 <b>Usuario:</b> ${escapeHtml(report.userName)}\n` +
    `🕒 <b>Generado:</b> ${escapeHtml(report.generatedAt)}\n\n` +
    `💸 <b>Gastos de hoy:</b> ${formatCOP(report.todayExpensesCOP)}\n` +
    `📅 <b>Gastos del mes:</b> ${formatCOP(report.monthExpensesCOP)} (${report.monthExpensesCount})\n` +
    `🏷️ <b>Categoría principal:</b> ${topCategory}\n\n` +
    `🏦 <b>Ahorros actuales:</b> ${formatCOP(report.savingsBalanceCOP)} en ${report.savingsBoxesCount} cajita(s)\n` +
    `⚠️ <b>Recurrentes próximos:</b> ${report.upcomingRecurringCount} por ${formatCOP(report.upcomingRecurringTotalCOP)}`

  return sendTelegramMessage(chatId, message)
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
