import { Router, Response } from 'express'
import db from '../../database'
import { authRequired, type AuthRequest } from '../../middleware/auth'
import { sendTestEmail, sendRecurringExpenseReminder } from '../../services/emailService'
import { sendTestTelegramMessage, sendDailySavingsReport, sendTelegramFinanceReport } from '../../services/telegramService'
import { processDueRecurringExpenses } from '../../services/recurringService'
import { getWhatsAppConfigStatus, getWhatsAppSessionStatus, sendTestWhatsAppMessage, sendWhatsAppFinanceReport } from '../../services/whatsperService'

const router = Router()
router.use(authRequired)

// GET /api/notifications/settings
router.get('/settings', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  let settings = db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').get(userId) as any

  if (!settings) {
    db.prepare(`
      INSERT INTO notification_settings (user_id, email_enabled, email_address, whatsapp_enabled, notify_days_before, credit_card_notify_days_before)
      VALUES (?, 1, ?, 1, 1, 3)
    `).run(userId, req.user!.email)
    settings = db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').get(userId)
  }

  res.json(settings)
})

// PUT /api/notifications/settings
router.put('/settings', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const { email_enabled, email_address, telegram_enabled, telegram_chat_id, whatsapp_enabled, notify_days_before, credit_card_notify_days_before } = req.body

  const existing = db.prepare('SELECT id FROM notification_settings WHERE user_id = ?').get(userId)
  if (!existing) {
    db.prepare(`
      INSERT INTO notification_settings (user_id, email_enabled, email_address, whatsapp_enabled, notify_days_before, credit_card_notify_days_before)
      VALUES (?, 1, ?, 1, 1, 3)
    `).run(userId, req.user!.email)
  }

  db.prepare(`
    UPDATE notification_settings
    SET email_enabled = COALESCE(?, email_enabled),
        email_address = COALESCE(?, email_address),
        telegram_enabled = COALESCE(?, telegram_enabled),
        telegram_chat_id = COALESCE(?, telegram_chat_id),
        whatsapp_enabled = COALESCE(?, whatsapp_enabled),
        notify_days_before = COALESCE(?, notify_days_before),
        credit_card_notify_days_before = COALESCE(?, credit_card_notify_days_before),
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(
    email_enabled !== undefined ? (email_enabled ? 1 : 0) : null,
    email_address,
    telegram_enabled !== undefined ? (telegram_enabled ? 1 : 0) : null,
    telegram_chat_id,
    whatsapp_enabled !== undefined ? (whatsapp_enabled ? 1 : 0) : null,
    notify_days_before,
    credit_card_notify_days_before,
    userId,
  )

  const updated = db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').get(userId)
  res.json(updated)
})

// POST /api/notifications/test — send test email
router.post('/test', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const settings = db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').get(userId) as any

  if (!settings?.email_address) {
    res.status(400).json({ error: 'No hay dirección de email configurada' })
    return
  }

  try {
    await sendTestEmail(settings.email_address)
    res.json({ message: `Email de prueba enviado a ${settings.email_address}` })
  } catch (err: any) {
    console.error('Test email error:', err)
    res.status(500).json({ error: `Error al enviar email: ${err.message}` })
  }
})

// POST /api/notifications/test-telegram — send test Telegram message
router.post('/test-telegram', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const settings = db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').get(userId) as any

  if (!settings?.telegram_chat_id) {
    res.status(400).json({ error: 'No hay Chat ID de Telegram configurado' })
    return
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN no configurado en el servidor' })
    return
  }

  try {
    await sendTestTelegramMessage(settings.telegram_chat_id)
    res.json({ message: `Mensaje de prueba enviado a Telegram (Chat ID: ${settings.telegram_chat_id})` })
  } catch (err: any) {
    console.error('Test telegram error:', err)
    res.status(500).json({ error: `Error al enviar mensaje de Telegram: ${err.message}` })
  }
})

// POST /api/notifications/telegram/report — send manual finance report via Telegram
router.post('/telegram/report', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const settings = db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').get(userId) as any

  if (!settings?.telegram_chat_id) {
    res.status(400).json({ error: 'No hay Chat ID de Telegram configurado' })
    return
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN no configurado en el servidor' })
    return
  }

  try {
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as any
    const report = buildFinanceReport(userId, user?.name || req.user!.email)
    const result = await sendTelegramFinanceReport(settings.telegram_chat_id, report)
    res.json({ message: 'Reporte financiero enviado por Telegram', report, result })
  } catch (err: any) {
    console.error('Telegram report error:', err)
    res.status(500).json({ error: `Error al enviar reporte por Telegram: ${err.message}` })
  }
})

// GET /api/notifications/whatsapp/status — check WhatsApp/Whatsper configuration and session status
router.get('/whatsapp/status', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const settings = db.prepare('SELECT whatsapp_enabled FROM notification_settings WHERE user_id = ?').get(userId) as any
  const config = getWhatsAppConfigStatus()
  const enabled = settings?.whatsapp_enabled !== 0

  if (!config.configured) {
    res.json({
      enabled,
      configured: false,
      config,
      session: null,
      message: 'WhatsApp no configurado completamente en el servidor',
    })
    return
  }

  if (!enabled) {
    res.json({
      enabled,
      configured: true,
      config,
      session: null,
      message: 'WhatsApp está apagado. No se consultó Whatsper para evitar consumo innecesario.',
    })
    return
  }

  try {
    const status = await getWhatsAppSessionStatus()
    res.json({
      enabled,
      configured: true,
      config,
      session: status.data || status,
    })
  } catch (err: any) {
    console.error('WhatsApp status error:', err)
    res.status(500).json({
      enabled,
      configured: true,
      config,
      error: err.response?.data || err.message,
    })
  }
})

// POST /api/notifications/whatsapp/test — send test WhatsApp message
router.post('/whatsapp/test', async (req: AuthRequest, res: Response) => {
  const settings = db.prepare('SELECT whatsapp_enabled FROM notification_settings WHERE user_id = ?').get(req.user!.id) as any
  if (settings?.whatsapp_enabled === 0) {
    res.status(400).json({ error: 'WhatsApp está apagado. Actívalo para enviar mensajes y consumir cupo de Whatsper.' })
    return
  }

  try {
    const result = await sendTestWhatsAppMessage()
    res.json({ message: 'Mensaje de prueba enviado por WhatsApp', result })
  } catch (err: any) {
    console.error('WhatsApp test error:', err)
    res.status(500).json({ error: `Error al enviar WhatsApp: ${err.response?.data?.message || err.message}` })
  }
})

// POST /api/notifications/whatsapp/report — send manual finance report via WhatsApp
router.post('/whatsapp/report', async (req: AuthRequest, res: Response) => {
  const settings = db.prepare('SELECT whatsapp_enabled FROM notification_settings WHERE user_id = ?').get(req.user!.id) as any
  if (settings?.whatsapp_enabled === 0) {
    res.status(400).json({ error: 'WhatsApp está apagado. Actívalo para enviar reportes y consumir cupo de Whatsper.' })
    return
  }

  try {
    const userId = req.user!.id
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as any
    const report = buildFinanceReport(userId, user?.name || req.user!.email)
    const result = await sendWhatsAppFinanceReport(report)
    res.json({ message: 'Reporte financiero enviado por WhatsApp', report, result })
  } catch (err: any) {
    console.error('WhatsApp report error:', err)
    res.status(500).json({ error: `Error al enviar reporte por WhatsApp: ${err.response?.data?.message || err.message}` })
  }
})

// POST /api/notifications/check-due — check and notify upcoming expenses
router.post('/check-due', async (req: AuthRequest, res: Response) => {
  try {
    const result = await checkAndNotifyDueExpenses()
    const result2 = await processDueRecurringExpenses()
    res.json({ notifications: result, recurring: result2 })
  } catch (err: any) {
    console.error('Check-due error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/notifications/send-savings-report — manually trigger savings report
router.post('/send-savings-report', async (req: AuthRequest, res: Response) => {
  try {
    const result = await checkAndNotifyDailySavings()
    res.json(result)
  } catch (err: any) {
    console.error('Savings report error:', err)
    res.status(500).json({ error: err.message })
  }
})

function buildFinanceReport(userId: number, userName: string) {
  const todayExpenses = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(amount_cop, amount)), 0) as total
    FROM expenses
    WHERE user_id = ? AND date = date('now')
  `).get(userId) as any

  const monthExpenses = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(amount_cop, amount)), 0) as total, COUNT(*) as count
    FROM expenses
    WHERE user_id = ? AND date >= date('now', 'start of month')
  `).get(userId) as any

  const savings = db.prepare(`
    SELECT COALESCE(SUM(balance), 0) as total, COUNT(*) as count
    FROM savings_boxes
    WHERE user_id = ?
  `).get(userId) as any

  const upcoming = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(amount_cop, amount)), 0) as total, COUNT(*) as count
    FROM expenses
    WHERE user_id = ?
      AND is_recurring = 1
      AND next_due_date IS NOT NULL
      AND next_due_date <= date('now', '+7 days')
      AND next_due_date >= date('now')
  `).get(userId) as any

  const topCategory = db.prepare(`
    SELECT COALESCE(c.name, 'Sin categoría') as name,
           COALESCE(SUM(COALESCE(e.amount_cop, e.amount)), 0) as total
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE e.user_id = ? AND e.date >= date('now', 'start of month')
    GROUP BY COALESCE(c.id, 0)
    ORDER BY total DESC
    LIMIT 1
  `).get(userId) as any

  return {
    userName,
    generatedAt: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
    todayExpensesCOP: todayExpenses.total || 0,
    monthExpensesCOP: monthExpenses.total || 0,
    monthExpensesCount: monthExpenses.count || 0,
    savingsBalanceCOP: savings.total || 0,
    savingsBoxesCount: savings.count || 0,
    upcomingRecurringCount: upcoming.count || 0,
    upcomingRecurringTotalCOP: upcoming.total || 0,
    topCategoryName: topCategory?.name || null,
    topCategoryTotalCOP: topCategory?.total || 0,
  }
}

// ===== Expense Notification Scheduler =====
export async function checkAndNotifyDueExpenses() {
  const usersWithNotifications = db.prepare(`
    SELECT ns.*, u.email as user_email, u.name as user_name
    FROM notification_settings ns
    JOIN users u ON ns.user_id = u.id
    WHERE ns.email_enabled = 1 AND ns.email_address IS NOT NULL
  `).all() as any[]

  let totalNotified = 0

  for (const settings of usersWithNotifications) {
    const daysAdvance = settings.notify_days_before || 1

    const dueExpenses = db.prepare(`
      SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
             cur.code as currency_code, cur.symbol as currency_symbol
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      JOIN currencies cur ON e.currency_id = cur.id
      WHERE e.user_id = ? AND e.is_recurring = 1
        AND e.next_due_date IS NOT NULL
        AND e.next_due_date <= date('now', '+' || ? || ' days')
        AND e.next_due_date >= date('now')
      ORDER BY e.next_due_date ASC
    `).all(settings.user_id, daysAdvance) as any[]

    if (dueExpenses.length > 0) {
      try {
        await sendRecurringExpenseReminder(settings.email_address, dueExpenses)
        totalNotified += dueExpenses.length
        console.log(`📧 Enviado recordatorio a ${settings.email_address}: ${dueExpenses.length} gastos`)
      } catch (err) {
        console.error(`Error enviando a ${settings.email_address}:`, err)
      }
    }
  }

  return { message: `Revisión completada. ${totalNotified} notificaciones enviadas.`, notified: totalNotified }
}

// ===== Daily Savings Notification (Telegram) =====
export async function checkAndNotifyDailySavings() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return { message: 'TELEGRAM_BOT_TOKEN no configurado, omitiendo notificaciones de Telegram.', sent: 0 }
  }

  const usersWithTelegram = db.prepare(`
    SELECT ns.*, u.name as user_name
    FROM notification_settings ns
    JOIN users u ON ns.user_id = u.id
    WHERE ns.telegram_enabled = 1 AND ns.telegram_chat_id IS NOT NULL AND ns.telegram_chat_id != ''
  `).all() as any[]

  let totalSent = 0

  for (const settings of usersWithTelegram) {
    // Get all boxes with bank rates
    const boxes = db.prepare(`
      SELECT sb.*, b.name as bank_name, b.rate_ea as bank_rate
      FROM savings_boxes sb
      JOIN banks b ON sb.bank_id = b.id
      WHERE sb.user_id = ?
      ORDER BY sb.balance DESC
    `).all(settings.user_id) as any[]

    // Calculate total interest earned all-time from movements
    const totalInterestResult = db.prepare(`
      SELECT COALESCE(SUM(sm.amount), 0) as total
      FROM savings_movements sm
      JOIN savings_boxes sb ON sm.savings_box_id = sb.id
      WHERE sb.user_id = ? AND sm.type = 'interest'
    `).get(settings.user_id) as any

    try {
      await sendDailySavingsReport(settings.telegram_chat_id, boxes, totalInterestResult.total)
      totalSent++
      console.log(`📱 Reporte diario de ahorros enviado a Telegram para ${settings.user_name}`)
    } catch (err) {
      console.error(`Error enviando Telegram a ${settings.user_name}:`, err)
    }
  }

  return { message: `Reporte diario enviado a ${totalSent} usuario(s) vía Telegram.`, sent: totalSent }
}

// ===== Schedulers =====
let expenseScheduler: ReturnType<typeof setInterval> | null = null
let savingsScheduler: ReturnType<typeof setInterval> | null = null

export function startNotificationScheduler() {
  // Expense notifications: every 12 hours
  const EXPENSE_INTERVAL = 12 * 60 * 60 * 1000

  setTimeout(() => {
    checkAndNotifyDueExpenses().catch(err => console.error('Scheduled expense check failed:', err))
    processDueRecurringExpenses().catch(err => console.error('Scheduled recurring process failed:', err))
  }, 30_000)

  expenseScheduler = setInterval(() => {
    checkAndNotifyDueExpenses().catch(err => console.error('Scheduled expense check failed:', err))
    processDueRecurringExpenses().catch(err => console.error('Scheduled recurring process failed:', err))
  }, EXPENSE_INTERVAL)

  // Daily savings report: every 24 hours (first run in 1 minute)
  const SAVINGS_INTERVAL = 24 * 60 * 60 * 1000

  setTimeout(() => {
    checkAndNotifyDailySavings().catch(err => console.error('Scheduled savings report failed:', err))
  }, 60_000) // 1 minute after boot

  savingsScheduler = setInterval(() => {
    checkAndNotifyDailySavings().catch(err => console.error('Scheduled savings report failed:', err))
  }, SAVINGS_INTERVAL)

  console.log('⏰ Notification scheduler started (expenses: 12h, savings: 24h)')
}

export function stopNotificationScheduler() {
  if (expenseScheduler) { clearInterval(expenseScheduler); expenseScheduler = null }
  if (savingsScheduler) { clearInterval(savingsScheduler); savingsScheduler = null }
}

export default router
