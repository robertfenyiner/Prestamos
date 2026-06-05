import { Router, Response } from 'express'
import db from '../../database'
import { authRequired, type AuthRequest } from '../../middleware/auth'

const router = Router()
router.use(authRequired)

type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'

type LoanRow = {
  id: number
  user_id: number
  client_id: number
  principal_amount: number
  interest_rate: number
  interest_amount: number
  total_amount: number
  installments_count: number
  frequency: Frequency
  first_due_date: string
  late_fee_rate: number
  status: 'active' | 'paid' | 'cancelled'
}

function cleanText(value: unknown) {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text.length ? text : null
}

function money(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

function dueDate(firstDueDate: string, frequency: Frequency, index: number) {
  const first = new Date(`${firstDueDate}T12:00:00`)
  if (frequency === 'daily') return toDateString(addDays(first, index))
  if (frequency === 'weekly') return toDateString(addDays(first, index * 7))
  if (frequency === 'biweekly') return toDateString(addDays(first, index * 14))
  return toDateString(addMonths(first, index))
}

function getLoan(id: number | string, userId: number) {
  return db.prepare(`
    SELECT l.*, c.name as client_name, c.phone as client_phone, cu.code as currency_code, cu.symbol as currency_symbol
    FROM loans l
    JOIN clients c ON c.id = l.client_id
    JOIN currencies cu ON cu.id = l.currency_id
    WHERE l.id = ? AND l.user_id = ?
  `).get(id, userId) as (LoanRow & Record<string, any>) | undefined
}

function recalcLoanStatus(loanId: number | string, userId: number) {
  const pending = db.prepare(`
    SELECT COUNT(*) as count
    FROM loan_installments
    WHERE loan_id = ? AND user_id = ? AND status NOT IN ('paid', 'cancelled')
  `).get(loanId, userId) as { count: number }

  if (pending.count === 0) {
    db.prepare(`UPDATE loans SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND status = 'active'`).run(loanId, userId)
  }
}

router.get('/', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const { status = 'all', search, limit = '100', offset = '0' } = req.query

  let query = `
    SELECT l.*, c.name as client_name, c.phone as client_phone, cu.code as currency_code, cu.symbol as currency_symbol,
      COALESCE(SUM(i.total_amount), 0) as scheduled_total,
      COALESCE(SUM(i.paid_amount), 0) as paid_total,
      COALESCE(SUM(i.total_amount - i.paid_amount), 0) as balance,
      COALESCE(SUM(CASE WHEN i.status NOT IN ('paid', 'cancelled') AND date(i.due_date) < date('now') THEN 1 ELSE 0 END), 0) as overdue_count
    FROM loans l
    JOIN clients c ON c.id = l.client_id
    JOIN currencies cu ON cu.id = l.currency_id
    LEFT JOIN loan_installments i ON i.loan_id = l.id
    WHERE l.user_id = ?
  `
  const params: any[] = [userId]

  if (status && status !== 'all') {
    query += ' AND l.status = ?'
    params.push(String(status))
  }
  if (search) {
    query += ' AND (c.name LIKE ? OR COALESCE(c.phone, \'\') LIKE ? OR COALESCE(l.notes, \'\') LIKE ?)'
    const term = `%${search}%`
    params.push(term, term, term)
  }

  query += ' GROUP BY l.id ORDER BY l.created_at DESC LIMIT ? OFFSET ?'
  params.push(Number(limit), Number(offset))

  const loans = db.prepare(query).all(...params)
  const summary = db.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) as active,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END), 0) as paid,
      COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled,
      COALESCE(SUM(CASE WHEN status = 'active' THEN principal_amount ELSE 0 END), 0) as active_principal,
      COALESCE(SUM(CASE WHEN status = 'active' THEN total_amount ELSE 0 END), 0) as active_total
    FROM loans WHERE user_id = ?
  `).get(userId)

  const overdue = db.prepare(`
    SELECT COUNT(*) as overdue_installments
    FROM loan_installments
    WHERE user_id = ? AND status NOT IN ('paid', 'cancelled') AND date(due_date) < date('now')
  `).get(userId)

  res.json({ loans, summary: { ...(summary as object), ...(overdue as object) } })
})

router.get('/:id', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const id = String(req.params.id)
  const loan = getLoan(id, userId)
  if (!loan) {
    res.status(404).json({ error: 'Préstamo no encontrado' })
    return
  }
  const installments = db.prepare(`
    SELECT * FROM loan_installments WHERE loan_id = ? AND user_id = ? ORDER BY installment_number ASC
  `).all(id, userId)
  const payments = db.prepare(`
    SELECT * FROM loan_payments WHERE loan_id = ? AND user_id = ? ORDER BY payment_date DESC, id DESC
  `).all(id, userId)
  res.json({ loan, installments, payments })
})

router.post('/', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const {
    client_id,
    currency_id = 1,
    principal_amount,
    interest_rate = 0,
    installments_count = 1,
    frequency = 'monthly',
    start_date = new Date().toISOString().slice(0, 10),
    first_due_date,
    late_fee_rate = 0,
    notes,
  } = req.body

  const principal = Number(principal_amount)
  const rate = Number(interest_rate)
  const count = Number(installments_count)
  const lateRate = Number(late_fee_rate)
  const freq = String(frequency) as Frequency

  if (!client_id) {
    res.status(400).json({ error: 'Cliente requerido' })
    return
  }
  const client = db.prepare('SELECT id FROM clients WHERE id = ? AND user_id = ? AND status = \'active\'').get(client_id, userId)
  if (!client) {
    res.status(400).json({ error: 'Cliente activo no encontrado' })
    return
  }
  if (!Number.isFinite(principal) || principal <= 0) {
    res.status(400).json({ error: 'Valor prestado inválido' })
    return
  }
  if (!Number.isInteger(count) || count <= 0 || count > 240) {
    res.status(400).json({ error: 'Número de cuotas inválido' })
    return
  }
  if (!['daily', 'weekly', 'biweekly', 'monthly'].includes(freq)) {
    res.status(400).json({ error: 'Frecuencia no válida' })
    return
  }

  const firstDue = cleanText(first_due_date) || start_date
  const interest = money(principal * (rate / 100))
  const total = money(principal + interest)
  const principalBase = money(principal / count)
  const interestBase = money(interest / count)
  const totalBase = money(total / count)

  const trx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO loans (
        user_id, client_id, currency_id, principal_amount, interest_rate, interest_amount,
        total_amount, installments_count, frequency, start_date, first_due_date, late_fee_rate, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, client_id, currency_id, principal, rate, interest, total, count, freq, start_date, firstDue, lateRate, cleanText(notes))

    const loanId = Number(result.lastInsertRowid)
    let principalAccum = 0
    let interestAccum = 0
    let totalAccum = 0

    for (let i = 1; i <= count; i++) {
      const last = i === count
      const p = last ? money(principal - principalAccum) : principalBase
      const it = last ? money(interest - interestAccum) : interestBase
      const tt = last ? money(total - totalAccum) : totalBase
      principalAccum = money(principalAccum + p)
      interestAccum = money(interestAccum + it)
      totalAccum = money(totalAccum + tt)

      db.prepare(`
        INSERT INTO loan_installments (
          user_id, loan_id, installment_number, due_date,
          principal_amount, interest_amount, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(userId, loanId, i, dueDate(String(firstDue), freq, i - 1), p, it, tt)
    }

    return loanId
  })

  const loanId = trx()
  res.status(201).json({ loan: getLoan(loanId, userId), installments: db.prepare('SELECT * FROM loan_installments WHERE loan_id = ? ORDER BY installment_number ASC').all(loanId) })
})

router.post('/:id/payments', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const id = String(req.params.id)
  const loan = getLoan(id, userId)
  if (!loan) {
    res.status(404).json({ error: 'Préstamo no encontrado' })
    return
  }

  const { installment_id, amount, payment_date = new Date().toISOString().slice(0, 10), method = 'cash', notes } = req.body
  const payAmount = Number(amount)
  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    res.status(400).json({ error: 'Monto de pago inválido' })
    return
  }

  const trx = db.transaction(() => {
    let target = installment_id
    if (!target) {
      const next = db.prepare(`
        SELECT id FROM loan_installments
        WHERE loan_id = ? AND user_id = ? AND status NOT IN ('paid', 'cancelled')
        ORDER BY due_date ASC, installment_number ASC LIMIT 1
      `).get(id, userId) as { id: number } | undefined
      target = next?.id
    }
    if (!target) throw new Error('No hay cuotas pendientes')

    const installment = db.prepare('SELECT * FROM loan_installments WHERE id = ? AND loan_id = ? AND user_id = ?').get(target, id, userId) as any
    if (!installment) throw new Error('Cuota no encontrada')

    const newPaid = money(Number(installment.paid_amount) + payAmount)
    const status = newPaid >= Number(installment.total_amount) ? 'paid' : 'partial'

    db.prepare(`
      UPDATE loan_installments
      SET paid_amount = ?, status = ?, paid_at = CASE WHEN ? = 'paid' THEN CURRENT_TIMESTAMP ELSE paid_at END, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND loan_id = ? AND user_id = ?
    `).run(newPaid, status, status, target, id, userId)

    const payment = db.prepare(`
      INSERT INTO loan_payments (user_id, loan_id, installment_id, amount, payment_date, method, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, id, target, payAmount, payment_date, cleanText(method) || 'cash', cleanText(notes))

    recalcLoanStatus(id, userId)
    return Number(payment.lastInsertRowid)
  })

  try {
    trx()
    const updatedLoan = getLoan(id, userId)
    const installments = db.prepare('SELECT * FROM loan_installments WHERE loan_id = ? AND user_id = ? ORDER BY installment_number ASC').all(id, userId)
    res.json({ loan: updatedLoan, installments })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const id = String(req.params.id)
  const loan = getLoan(id, userId)
  if (!loan) {
    res.status(404).json({ error: 'Préstamo no encontrado' })
    return
  }
  db.prepare(`UPDATE loans SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`).run(id, userId)
  db.prepare(`UPDATE loan_installments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE loan_id = ? AND user_id = ? AND status NOT IN ('paid', 'cancelled')`).run(id, userId)
  res.json({ message: 'Préstamo cancelado', loan: getLoan(id, userId) })
})

export default router
