import { Router, Response } from 'express'
import db from '../../database'
import { authRequired, type AuthRequest } from '../../middleware/auth'

const router = Router()
router.use(authRequired)

// GET /api/dashboard/summary
router.get('/summary', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id

  // Total savings
  const savings = db.prepare(`
    SELECT COALESCE(SUM(balance), 0) as total
    FROM savings_boxes WHERE user_id = ?
  `).get(userId) as any

  // Expenses this month (use amount_cop for consistent totals)
  const expensesThisMonth = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(amount_cop, amount)), 0) as total, COUNT(*) as count
    FROM expenses
    WHERE user_id = ? AND date >= date('now', 'start of month')
  `).get(userId) as any

  // Expenses last month
  const expensesLastMonth = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(amount_cop, amount)), 0) as total
    FROM expenses
    WHERE user_id = ? AND date >= date('now', 'start of month', '-1 month') AND date < date('now', 'start of month')
  `).get(userId) as any

  // Savings goal progress
  const savingsGoals = db.prepare(`
    SELECT COALESCE(SUM(balance), 0) as current, COALESCE(SUM(goal), 0) as target
    FROM savings_boxes WHERE user_id = ? AND goal > 0
  `).get(userId) as any

  // Recent transactions (with currency info)
  const recentExpenses = db.prepare(`
    SELECT e.id, e.description, e.amount, e.amount_cop, e.exchange_rate, e.date,
           c.name as category, c.icon as category_icon,
           cur.code as currency_code, cur.symbol as currency_symbol
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    JOIN currencies cur ON e.currency_id = cur.id
    WHERE e.user_id = ?
    ORDER BY e.date DESC, e.id DESC
    LIMIT 5
  `).all(userId)

  // Savings boxes summary
  const boxes = db.prepare(`
    SELECT sb.name, sb.balance, sb.goal, b.name as bank_name, b.rate_ea
    FROM savings_boxes sb
    JOIN banks b ON sb.bank_id = b.id
    WHERE sb.user_id = ?
    ORDER BY sb.balance DESC
    LIMIT 4
  `).all(userId)

  // Monthly trend (last 6 months)
  const monthlyTrend = db.prepare(`
    SELECT strftime('%Y-%m', date) as month, SUM(COALESCE(amount_cop, amount)) as total
    FROM expenses
    WHERE user_id = ? AND date >= date('now', '-6 months')
    GROUP BY strftime('%Y-%m', date)
    ORDER BY month
  `).all(userId)

  // Expenses by company this month
  const expensesByCompany = db.prepare(`
    SELECT comp.name, comp.color, SUM(COALESCE(e.amount_cop, e.amount)) as total
    FROM expenses e
    LEFT JOIN companies comp ON e.company_id = comp.id
    WHERE e.user_id = ? AND e.date >= date('now', 'start of month')
    GROUP BY COALESCE(comp.id, 0)
    ORDER BY total DESC
  `).all(userId)

  const expenseChange = expensesLastMonth.total > 0
    ? ((expensesThisMonth.total - expensesLastMonth.total) / expensesLastMonth.total * 100).toFixed(1)
    : '0'

  res.json({
    balance: savings.total - expensesThisMonth.total,
    totalSavings: savings.total,
    expensesThisMonth: expensesThisMonth.total,
    expenseCount: expensesThisMonth.count,
    expenseChange: Number(expenseChange),
    savingsGoalProgress: savingsGoals.target > 0
      ? Math.round((savingsGoals.current / savingsGoals.target) * 100)
      : 0,
    recentExpenses,
    savingsBoxes: boxes,
    monthlyTrend,
    expensesByCompany,
  })
})

export default router
