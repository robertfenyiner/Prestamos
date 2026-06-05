import db from '../database'
import { sendTelegramMessage } from './telegramService'

interface AlertSettings {
  user_id: number
  user_name: string
  telegram_chat_id: string
  credit_card_notify_days_before: number
}

interface UpcomingInstallment {
  id: number
  description: string
  card_name: string
  bank_name: string
  installment_number: number
  due_date: string
  remaining_amount: number
}

interface UpcomingCardDate {
  id: number
  name: string
  bank_name: string
  last_four: string | null
  cut_day: number
  payment_due_day: number
  next_cut_date: string
  next_payment_date: string
  days_until_cut: number
  days_until_payment: number
}

function ensureAlertLogTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      channel TEXT NOT NULL,
      type TEXT NOT NULL,
      reference TEXT NOT NULL,
      sent_date DATE NOT NULL DEFAULT (date('now')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, channel, type, reference, sent_date)
    );
  `)
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

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function daysBetween(a: Date, b: Date) {
  const ms = dateOnly(b) >= dateOnly(a)
    ? new Date(dateOnly(b)).getTime() - new Date(dateOnly(a)).getTime()
    : 0
  return Math.round(ms / 86400000)
}

function nextDateForDay(day: number) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), Math.min(Math.max(day, 1), 28), 12, 0, 0)
  if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)) {
    d.setMonth(d.getMonth() + 1)
  }
  return d
}

function wasSentToday(userId: number, reference: string) {
  const row = db.prepare(`
    SELECT id FROM notification_log
    WHERE user_id = ? AND channel = 'telegram' AND type = 'credit_card_alert'
      AND reference = ? AND sent_date = date('now')
  `).get(userId, reference)
  return !!row
}

function markSent(userId: number, reference: string) {
  db.prepare(`
    INSERT OR IGNORE INTO notification_log (user_id, channel, type, reference)
    VALUES (?, 'telegram', 'credit_card_alert', ?)
  `).run(userId, reference)
}

function buildMessage(userName: string, days: number, installments: UpcomingInstallment[], cards: UpcomingCardDate[]) {
  const installmentLines = installments.length
    ? installments.slice(0, 10).map(item =>
      `• <b>${escapeHtml(item.description)}</b>\n` +
      `  ${escapeHtml(item.card_name)} · cuota ${item.installment_number}\n` +
      `  Vence: ${escapeHtml(item.due_date)} · ${formatCOP(item.remaining_amount)}`
    ).join('\n')
    : 'Sin cuotas próximas.'

  const cutLines = cards.length
    ? cards.slice(0, 8).map(card => {
      const suffix = card.last_four ? ` *${escapeHtml(card.last_four)}` : ''
      const alerts: string[] = []
      if (card.days_until_cut <= days) alerts.push(`corte ${card.next_cut_date} (${card.days_until_cut} día(s))`)
      if (card.days_until_payment <= days) alerts.push(`pago ${card.next_payment_date} (${card.days_until_payment} día(s))`)
      return `• <b>${escapeHtml(card.name)}${suffix}</b> — ${alerts.join(' · ')}`
    }).join('\n')
    : 'Sin cortes o fechas de pago próximas.'

  return `💳 <b>Prestamos — Alertas de tarjetas</b>\n\n` +
    `👤 <b>Usuario:</b> ${escapeHtml(userName)}\n` +
    `⏰ <b>Rango:</b> próximos ${days} día(s)\n\n` +
    `<b>Cuotas próximas:</b>\n${installmentLines}\n\n` +
    `<b>Cortes / pagos próximos:</b>\n${cutLines}`
}

export async function checkAndNotifyCreditCardAlerts() {
  ensureAlertLogTable()

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return { message: 'TELEGRAM_BOT_TOKEN no configurado, omitiendo alertas de tarjetas.', sent: 0 }
  }

  const users = db.prepare(`
    SELECT ns.user_id, u.name as user_name, ns.telegram_chat_id,
           COALESCE(ns.credit_card_notify_days_before, 3) as credit_card_notify_days_before
    FROM notification_settings ns
    JOIN users u ON u.id = ns.user_id
    WHERE ns.telegram_enabled = 1
      AND ns.telegram_chat_id IS NOT NULL
      AND ns.telegram_chat_id != ''
  `).all() as AlertSettings[]

  let totalSent = 0

  for (const settings of users) {
    const days = Math.max(1, Math.min(15, Number(settings.credit_card_notify_days_before || 3)))
    const reference = `days-${days}`
    if (wasSentToday(settings.user_id, reference)) continue

    const installments = db.prepare(`
      SELECT i.id, ch.description, cc.name as card_name, cc.bank_name,
             i.installment_number, i.due_date,
             MAX(i.total_amount - COALESCE(i.paid_amount, 0), 0) as remaining_amount
      FROM credit_card_installments i
      JOIN credit_card_charges ch ON ch.id = i.charge_id
      JOIN credit_cards cc ON cc.id = i.card_id
      WHERE i.user_id = ?
        AND i.status = 'pending'
        AND i.due_date >= date('now')
        AND i.due_date <= date('now', '+' || ? || ' days')
      ORDER BY i.due_date ASC, cc.name ASC
      LIMIT 20
    `).all(settings.user_id, days) as UpcomingInstallment[]

    const rawCards = db.prepare(`
      SELECT id, name, bank_name, last_four, cut_day, payment_due_day
      FROM credit_cards
      WHERE user_id = ? AND is_active = 1
      ORDER BY name ASC
    `).all(settings.user_id) as any[]

    const now = new Date()
    const cards = rawCards.map(card => {
      const cutDate = nextDateForDay(Number(card.cut_day || 1))
      const payDate = nextDateForDay(Number(card.payment_due_day || 15))
      return {
        ...card,
        next_cut_date: dateOnly(cutDate),
        next_payment_date: dateOnly(payDate),
        days_until_cut: daysBetween(now, cutDate),
        days_until_payment: daysBetween(now, payDate),
      }
    }).filter(card => card.days_until_cut <= days || card.days_until_payment <= days) as UpcomingCardDate[]

    if (installments.length === 0 && cards.length === 0) continue

    try {
      await sendTelegramMessage(settings.telegram_chat_id, buildMessage(settings.user_name, days, installments, cards))
      markSent(settings.user_id, reference)
      totalSent++
      console.log(`💳 Alerta de tarjetas enviada a Telegram para ${settings.user_name}`)
    } catch (err) {
      console.error(`Error enviando alerta de tarjetas a ${settings.user_name}:`, err)
    }
  }

  return { message: `Alertas de tarjetas enviadas a ${totalSent} usuario(s) vía Telegram.`, sent: totalSent }
}
