import { Router, Response } from 'express'
import db from '../../database'
import { authRequired, type AuthRequest } from '../../middleware/auth'
import { convertToCOP } from '../../services/currencyService'

const router = Router()

// All routes require auth
router.use(authRequired)

// GET /api/gastos — list expenses
router.get('/', (req: AuthRequest, res: Response) => {
  const { category, company, from, to, search, limit = '50', offset = '0' } = req.query
  const userId = req.user!.id

  let query = `
    SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
           comp.name as company_name, comp.color as company_color,
           cur.code as currency_code, cur.symbol as currency_symbol
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    LEFT JOIN companies comp ON e.company_id = comp.id
    JOIN currencies cur ON e.currency_id = cur.id
    WHERE e.user_id = ?
  `
  const params: any[] = [userId]

  if (category) {
    query += ' AND c.name = ?'
    params.push(category)
  }
  if (company) {
    query += ' AND e.company_id = ?'
    params.push(company)
  }
  if (from) {
    query += ' AND e.date >= ?'
    params.push(from)
  }
  if (to) {
    query += ' AND e.date <= ?'
    params.push(to)
  }
  if (search) {
    query += ' AND e.description LIKE ?'
    params.push(`%${search}%`)
  }

  query += ' ORDER BY e.date DESC, e.id DESC LIMIT ? OFFSET ?'
  params.push(Number(limit), Number(offset))

  const expenses = db.prepare(query).all(...params)

  // Total for the current filters (use amount_cop for consistent totals)
  let countQuery = `
    SELECT COUNT(*) as total, 
           SUM(COALESCE(amount_cop, amount)) as total_amount_cop,
           SUM(amount) as total_amount
    FROM expenses WHERE user_id = ?
  `
  const countParams: any[] = [userId]

  if (from) {
    countQuery += ' AND date >= ?'
    countParams.push(from)
  }
  if (to) {
    countQuery += ' AND date <= ?'
    countParams.push(to)
  }

  const summary = db.prepare(countQuery).get(...countParams) as any

  res.json({
    expenses,
    total: summary.total,
    totalAmount: summary.total_amount || 0,
    totalAmountCOP: summary.total_amount_cop || 0,
  })
})

// GET /api/gastos/summary — monthly summary
router.get('/summary', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const { months = '6' } = req.query

  const monthlySummary = db.prepare(`
    SELECT
      strftime('%Y-%m', date) as month,
      SUM(COALESCE(amount_cop, amount)) as total,
      COUNT(*) as count
    FROM expenses
    WHERE user_id = ? AND date >= date('now', '-' || ? || ' months')
    GROUP BY strftime('%Y-%m', date)
    ORDER BY month DESC
  `).all(userId, Number(months))

  const byCategory = db.prepare(`
    SELECT
      c.name, c.icon, c.color,
      SUM(COALESCE(e.amount_cop, e.amount)) as total,
      COUNT(*) as count
    FROM expenses e
    JOIN categories c ON e.category_id = c.id
    WHERE e.user_id = ? AND e.date >= date('now', 'start of month')
    GROUP BY c.id
    ORDER BY total DESC
  `).all(userId)

  // Currency breakdown
  const byCurrency = db.prepare(`
    SELECT
      cur.code, cur.name, cur.symbol,
      SUM(e.amount) as total_original,
      SUM(COALESCE(e.amount_cop, e.amount)) as total_cop,
      COUNT(*) as count
    FROM expenses e
    JOIN currencies cur ON e.currency_id = cur.id
    WHERE e.user_id = ? AND e.date >= date('now', 'start of month')
    GROUP BY cur.id
    ORDER BY total_cop DESC
  `).all(userId)

  res.json({ monthlySummary, byCategory, byCurrency })
})

// GET /api/gastos/reports — detailed reports
router.get('/reports', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const { from, to, months = '12' } = req.query

  const dateFrom = from as string || null
  const dateTo = to as string || null
  const monthsNum = Number(months)

  // 1) Monthly trend (last N months)
  const monthlyTrend = db.prepare(`
    SELECT
      strftime('%Y-%m', date) as month,
      SUM(COALESCE(amount_cop, amount)) as total,
      COUNT(*) as count
    FROM expenses
    WHERE user_id = ? AND date >= date('now', '-' || ? || ' months')
    GROUP BY strftime('%Y-%m', date)
    ORDER BY month ASC
  `).all(userId, monthsNum)

  // 2) Daily breakdown for current month (or selected range)
  let dailyQuery = `
    SELECT date, SUM(COALESCE(amount_cop, amount)) as total, COUNT(*) as count
    FROM expenses WHERE user_id = ?
  `
  const dailyParams: any[] = [userId]
  if (dateFrom && dateTo) {
    dailyQuery += ' AND date >= ? AND date <= ?'
    dailyParams.push(dateFrom, dateTo)
  } else {
    dailyQuery += " AND date >= date('now', 'start of month')"
  }
  dailyQuery += ' GROUP BY date ORDER BY date ASC'
  const dailyBreakdown = db.prepare(dailyQuery).all(...dailyParams)

  // 3) Category breakdown with percentages
  let catQuery = `
    SELECT c.name, c.icon, c.color,
           SUM(COALESCE(e.amount_cop, e.amount)) as total,
           COUNT(*) as count
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE e.user_id = ?
  `
  const catParams: any[] = [userId]
  if (dateFrom && dateTo) {
    catQuery += ' AND e.date >= ? AND e.date <= ?'
    catParams.push(dateFrom, dateTo)
  } else {
    catQuery += " AND e.date >= date('now', '-' || ? || ' months')"
    catParams.push(monthsNum)
  }
  catQuery += ' GROUP BY COALESCE(c.id, 0) ORDER BY total DESC'
  const categoryBreakdown = db.prepare(catQuery).all(...catParams) as any[]

  const catTotal = categoryBreakdown.reduce((s: number, c: any) => s + c.total, 0)
  const categoryWithPct = categoryBreakdown.map(c => ({
    ...c,
    name: c.name || 'Sin categoría',
    icon: c.icon || '📋',
    color: c.color || '#6b7280',
    percentage: catTotal > 0 ? Math.round((c.total / catTotal) * 1000) / 10 : 0,
  }))

  // 4) Currency breakdown
  let curQuery = `
    SELECT cur.code, cur.name, cur.symbol,
           SUM(e.amount) as total_original,
           SUM(COALESCE(e.amount_cop, e.amount)) as total_cop,
           COUNT(*) as count
    FROM expenses e
    JOIN currencies cur ON e.currency_id = cur.id
    WHERE e.user_id = ?
  `
  const curParams: any[] = [userId]
  if (dateFrom && dateTo) {
    curQuery += ' AND e.date >= ? AND e.date <= ?'
    curParams.push(dateFrom, dateTo)
  } else {
    curQuery += " AND e.date >= date('now', '-' || ? || ' months')"
    curParams.push(monthsNum)
  }
  curQuery += ' GROUP BY cur.id ORDER BY total_cop DESC'
  const currencyBreakdown = db.prepare(curQuery).all(...curParams)

  // 5) Top 10 biggest expenses
  let topQuery = `
    SELECT e.description, e.amount, e.date,
           COALESCE(e.amount_cop, e.amount) as amount_cop,
           c.name as category_name, c.icon as category_icon, c.color as category_color,
           cur.code as currency_code, cur.symbol as currency_symbol
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    JOIN currencies cur ON e.currency_id = cur.id
    WHERE e.user_id = ?
  `
  const topParams: any[] = [userId]
  if (dateFrom && dateTo) {
    topQuery += ' AND e.date >= ? AND e.date <= ?'
    topParams.push(dateFrom, dateTo)
  } else {
    topQuery += " AND e.date >= date('now', '-' || ? || ' months')"
    topParams.push(monthsNum)
  }
  topQuery += ' ORDER BY COALESCE(e.amount_cop, e.amount) DESC LIMIT 10'
  const topExpenses = db.prepare(topQuery).all(...topParams)

  // 6) Recurring vs One-time
  let recQuery = `
    SELECT
      SUM(CASE WHEN is_recurring = 1 THEN COALESCE(amount_cop, amount) ELSE 0 END) as recurring_total,
      SUM(CASE WHEN is_recurring = 0 THEN COALESCE(amount_cop, amount) ELSE 0 END) as onetime_total,
      SUM(CASE WHEN is_recurring = 1 THEN 1 ELSE 0 END) as recurring_count,
      SUM(CASE WHEN is_recurring = 0 THEN 1 ELSE 0 END) as onetime_count
    FROM expenses WHERE user_id = ?
  `
  const recParams: any[] = [userId]
  if (dateFrom && dateTo) {
    recQuery += ' AND date >= ? AND date <= ?'
    recParams.push(dateFrom, dateTo)
  } else {
    recQuery += " AND date >= date('now', '-' || ? || ' months')"
    recParams.push(monthsNum)
  }
  const recurringVsOnetime = db.prepare(recQuery).get(...recParams)

  // 7) Month over month change
  const currentMonth = db.prepare(`
    SELECT SUM(COALESCE(amount_cop, amount)) as total
    FROM expenses WHERE user_id = ? AND date >= date('now', 'start of month')
  `).get(userId) as any

  const prevMonth = db.prepare(`
    SELECT SUM(COALESCE(amount_cop, amount)) as total
    FROM expenses WHERE user_id = ?
      AND date >= date('now', 'start of month', '-1 month')
      AND date < date('now', 'start of month')
  `).get(userId) as any

  const currentTotal = currentMonth?.total || 0
  const prevTotal = prevMonth?.total || 0
  const monthChange = prevTotal > 0
    ? Math.round(((currentTotal - prevTotal) / prevTotal) * 1000) / 10
    : null

  res.json({
    monthlyTrend,
    dailyBreakdown,
    categoryBreakdown: categoryWithPct,
    currencyBreakdown,
    topExpenses,
    recurringVsOnetime,
    monthOverMonth: { current: currentTotal, previous: prevTotal, changePercent: monthChange },
  })
})

// POST /api/gastos — create expense
router.post('/', (req: AuthRequest, res: Response) => {
  const { description, amount, currency_id = 1, category_id, company_id, date, is_recurring, recurring_frequency, notes, custom_exchange_rate } = req.body
  const userId = req.user!.id

  if (!description || !amount) {
    res.status(400).json({ error: 'Descripción y monto son requeridos' })
    return
  }

  // Get currency code
  const currency = db.prepare('SELECT code FROM currencies WHERE id = ?').get(currency_id) as any
  if (!currency) {
    res.status(400).json({ error: 'Moneda no válida' })
    return
  }

  // Auto-convert to COP or use custom rate
  let amountCOP: number | null = null
  let exchangeRate: number | null = null

  if (custom_exchange_rate && Number(custom_exchange_rate) > 0) {
    exchangeRate = Number(custom_exchange_rate)
    amountCOP = Math.round(amount * exchangeRate * 100) / 100
  } else {
    try {
      const conversion = convertToCOP(amount, currency.code)
      amountCOP = conversion.copAmount
      exchangeRate = conversion.exchangeRate
    } catch (err) {
      console.error('Error converting to COP:', err)
      // Continue without conversion — don't block creation
    }
  }

  // Calculate next due date for recurring
  let nextDueDate: string | null = null
  if (is_recurring && recurring_frequency) {
    const d = new Date(date || Date.now())
    switch (recurring_frequency) {
      case 'daily': d.setDate(d.getDate() + 1); break
      case 'weekly': d.setDate(d.getDate() + 7); break
      case 'monthly': d.setMonth(d.getMonth() + 1); break
      case 'yearly': d.setFullYear(d.getFullYear() + 1); break
    }
    nextDueDate = d.toISOString().split('T')[0]
  }

  const result = db.prepare(`
    INSERT INTO expenses (description, amount, currency_id, amount_cop, exchange_rate, category_id, company_id, user_id, date, is_recurring, recurring_frequency, next_due_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    description, amount, currency_id, amountCOP, exchangeRate,
    category_id || null, company_id || null, userId,
    date || new Date().toISOString().split('T')[0],
    is_recurring ? 1 : 0, recurring_frequency || null, nextDueDate, notes || null,
  )

  const expense = db.prepare(`
    SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
           comp.name as company_name, comp.color as company_color,
           cur.code as currency_code, cur.symbol as currency_symbol
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    LEFT JOIN companies comp ON e.company_id = comp.id
    JOIN currencies cur ON e.currency_id = cur.id
    WHERE e.id = ?
  `).get(result.lastInsertRowid)

  res.status(201).json(expense)
})

// PUT /api/gastos/:id — update expense
router.put('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user!.id
  const { description, amount, currency_id, category_id, company_id, date, is_recurring, recurring_frequency, notes, custom_exchange_rate } = req.body

  const existing = db.prepare('SELECT id FROM expenses WHERE id = ? AND user_id = ?').get(id, userId)
  if (!existing) {
    res.status(404).json({ error: 'Gasto no encontrado' })
    return
  }

  // If amount or currency changed, re-convert or use custom rate
  let amountCOP: number | null = null
  let exchangeRate: number | null = null

  if (custom_exchange_rate && Number(custom_exchange_rate) > 0 && amount) {
    exchangeRate = Number(custom_exchange_rate)
    amountCOP = Math.round(amount * exchangeRate * 100) / 100
  } else if (amount && currency_id) {
    const currency = db.prepare('SELECT code FROM currencies WHERE id = ?').get(currency_id) as any
    if (currency) {
      try {
        const conversion = convertToCOP(amount, currency.code)
        amountCOP = conversion.copAmount
        exchangeRate = conversion.exchangeRate
      } catch (err) { /* continue */ }
    }
  }

  db.prepare(`
    UPDATE expenses
    SET description = COALESCE(?, description),
        amount = COALESCE(?, amount),
        currency_id = COALESCE(?, currency_id),
        amount_cop = COALESCE(?, amount_cop),
        exchange_rate = COALESCE(?, exchange_rate),
        category_id = COALESCE(?, category_id),
        company_id = COALESCE(?, company_id),
        date = COALESCE(?, date),
        is_recurring = COALESCE(?, is_recurring),
        recurring_frequency = COALESCE(?, recurring_frequency),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(
    description, amount, currency_id, amountCOP, exchangeRate,
    category_id, company_id, date,
    is_recurring !== undefined ? (is_recurring ? 1 : 0) : null,
    recurring_frequency, notes,
    id, userId,
  )

  const updated = db.prepare(`
    SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
           comp.name as company_name, comp.color as company_color,
           cur.code as currency_code, cur.symbol as currency_symbol
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    LEFT JOIN companies comp ON e.company_id = comp.id
    JOIN currencies cur ON e.currency_id = cur.id
    WHERE e.id = ?
  `).get(id)

  res.json(updated)
})

// DELETE /api/gastos/:id
router.delete('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user!.id

  const result = db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').run(id, userId)
  if (result.changes === 0) {
    res.status(404).json({ error: 'Gasto no encontrado' })
    return
  }

  res.json({ message: 'Gasto eliminado' })
})

// GET /api/gastos/categories — list categories
router.get('/categories', (req: AuthRequest, res: Response) => {
  const categories = db.prepare(
    'SELECT * FROM categories WHERE user_id = ? OR user_id IS NULL ORDER BY name'
  ).all(req.user!.id)
  res.json(categories)
})

// POST /api/gastos/categories — create category
router.post('/categories', (req: AuthRequest, res: Response) => {
  const { name, icon, color } = req.body
  if (!name) {
    res.status(400).json({ error: 'Nombre de categoría requerido' })
    return
  }

  const result = db.prepare(
    'INSERT INTO categories (name, icon, color, user_id) VALUES (?, ?, ?, ?)'
  ).run(name, icon || '📦', color || '#6366f1', req.user!.id)

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(category)
})

// PUT /api/gastos/categories/:id — update category
router.put('/categories/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { name, icon, color } = req.body
  const userId = req.user!.id

  const existing = db.prepare('SELECT id FROM categories WHERE id = ? AND (user_id = ? OR user_id IS NULL)').get(id, userId)
  if (!existing) {
    res.status(404).json({ error: 'Categoría no encontrada' })
    return
  }

  db.prepare(`
    UPDATE categories SET name = COALESCE(?, name), icon = COALESCE(?, icon), color = COALESCE(?, color)
    WHERE id = ?
  `).run(name, icon, color, id)

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
  res.json(updated)
})

// DELETE /api/gastos/categories/:id — delete category
router.delete('/categories/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user!.id

  const existing = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').get(id, userId)
  if (!existing) {
    res.status(404).json({ error: 'Categoría no encontrada' })
    return
  }

  // Set expenses using this category to null
  db.prepare('UPDATE expenses SET category_id = NULL WHERE category_id = ? AND user_id = ?').run(id, userId)
  db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(id, userId)
  res.json({ message: 'Categoría eliminada' })
})

// GET /api/gastos/companies — list companies
router.get('/companies', (req: AuthRequest, res: Response) => {
  const companies = db.prepare(
    'SELECT * FROM companies WHERE user_id = ? ORDER BY name'
  ).all(req.user!.id)
  res.json(companies)
})

// POST /api/gastos/companies — create company
router.post('/companies', (req: AuthRequest, res: Response) => {
  const { name, description, color } = req.body
  if (!name) {
    res.status(400).json({ error: 'Nombre de empresa requerido' })
    return
  }

  const result = db.prepare(
    'INSERT INTO companies (name, description, color, user_id) VALUES (?, ?, ?, ?)'
  ).run(name, description || null, color || '#10b981', req.user!.id)

  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(company)
})

// PUT /api/gastos/companies/:id — update company
router.put('/companies/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { name, description, color } = req.body
  const userId = req.user!.id

  const existing = db.prepare('SELECT id FROM companies WHERE id = ? AND user_id = ?').get(id, userId)
  if (!existing) {
    res.status(404).json({ error: 'Empresa no encontrada' })
    return
  }

  db.prepare(`
    UPDATE companies SET name = COALESCE(?, name), description = COALESCE(?, description), color = COALESCE(?, color)
    WHERE id = ?
  `).run(name, description, color, id)

  const updated = db.prepare('SELECT * FROM companies WHERE id = ?').get(id)
  res.json(updated)
})

// DELETE /api/gastos/companies/:id — delete company
router.delete('/companies/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user!.id

  const existing = db.prepare('SELECT id FROM companies WHERE id = ? AND user_id = ?').get(id, userId)
  if (!existing) {
    res.status(404).json({ error: 'Empresa no encontrada' })
    return
  }

  // Set expenses using this company to null
  db.prepare('UPDATE expenses SET company_id = NULL WHERE company_id = ? AND user_id = ?').run(id, userId)
  db.prepare('DELETE FROM companies WHERE id = ? AND user_id = ?').run(id, userId)
  res.json({ message: 'Empresa eliminada' })
})

export default router

