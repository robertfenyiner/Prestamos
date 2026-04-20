import db, { initDatabase } from './index'
import bcrypt from 'bcryptjs'

export async function seedDatabase() {
  initDatabase()
  console.log('🌱 Seeding database...')

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any
  if (userCount.count > 0) {
    console.log('⚠️  Database already seeded, skipping')
    return
  }

  // Create admin user
  const hashedPassword = await bcrypt.hash('robert2026', 12)
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(
    'Robert', 'robert', hashedPassword, 'admin'
  )

  // Consolidated categories
  const categories = [
    { name: 'Alimentación', icon: '🍔', color: '#10b981' },
    { name: 'Transporte', icon: '🚗', color: '#3b82f6' },
    { name: 'Salud', icon: '❤️', color: '#ef4444' },
    { name: 'Entretenimiento', icon: '🎬', color: '#f59e0b' },
    { name: 'Compras', icon: '🛒', color: '#8b5cf6' },
    { name: 'Servicios Públicos', icon: '⚡', color: '#06b6d4' },
    { name: 'Internet/Telefonía', icon: '📶', color: '#6366f1' },
    { name: 'Streaming', icon: '📺', color: '#e50914' },
    { name: 'Seguros', icon: '🛡️', color: '#059669' },
    { name: 'Banco/Tarjetas', icon: '💳', color: '#dc2626' },
    { name: 'Educación', icon: '📚', color: '#1d4ed8' },
    { name: 'Viajes', icon: '✈️', color: '#0ea5e9' },
    { name: 'Hogar', icon: '🏠', color: '#d97706' },
    { name: 'Cuidado Personal', icon: '💇', color: '#be185d' },
    { name: 'Hosting/Dominios', icon: '🌐', color: '#374151' },
    { name: 'Software/Licencias', icon: '💻', color: '#7c3aed' },
    { name: 'Mascotas', icon: '🐾', color: '#f59e0b' },
    { name: 'Regalos', icon: '🎁', color: '#ec4899' },
    { name: 'Otros', icon: '📋', color: '#64748b' },
  ]

  const insertCat = db.prepare('INSERT INTO categories (name, icon, color, user_id) VALUES (?, ?, ?, 1)')
  for (const c of categories) {
    insertCat.run(c.name, c.icon, c.color)
  }

  // Banks with different rates
  const banks = [
    { name: 'Nu Colombia', rate_ea: 10.50 },
    { name: 'Bold', rate_ea: 8.75 },
    { name: 'Bancolombia', rate_ea: 5.50 },
    { name: 'Nequi', rate_ea: 11.00 },
    { name: 'Davivienda', rate_ea: 4.25 },
  ]
  const insertBank = db.prepare('INSERT INTO banks (name, rate_ea, user_id) VALUES (?, ?, 1)')
  for (const b of banks) {
    insertBank.run(b.name, b.rate_ea)
  }

  // ==================== 6 CAJITAS WITH DAILY INTEREST ====================
  // All created on 2026-02-18 → by 2026-03-18 = 28 days of daily interest history

  const startDate = new Date('2026-02-18')
  const endDate = new Date('2026-03-18')
  const DAYS = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  const cajitas = [
    { name: 'Fondo de Emergencia', bank_id: 1, initialBalance: 5000000, goal: 15000000, rate: 10.50 },
    { name: 'Inversión Cripto Reserve', bank_id: 4, initialBalance: 8200000, goal: 20000000, rate: 11.00, rateChange: { day: 14, newRate: 12.50 } },
    { name: 'Viaje Europa 2027', bank_id: 2, initialBalance: 3500000, goal: 12000000, rate: 8.75 },
    { name: 'MacBook Pro M5', bank_id: 3, initialBalance: 2100000, goal: 8500000, rate: 5.50, rateChange: { day: 10, newRate: 6.25 } },
    { name: 'Pago Universidad', bank_id: 5, initialBalance: 6800000, goal: 10000000, rate: 4.25 },
    { name: 'Casa Propia (Cuota Inicial)', bank_id: 1, initialBalance: 12000000, goal: 50000000, rate: 10.50, rateChange: { day: 20, newRate: 9.80 } },
  ]

  const insertBox = db.prepare(
    'INSERT INTO savings_boxes (name, bank_id, balance, goal, user_id, created_at) VALUES (?, ?, ?, ?, 1, ?)'
  )
  const insertMovement = db.prepare(
    'INSERT INTO savings_movements (savings_box_id, type, amount, description, date) VALUES (?, ?, ?, ?, ?)'
  )
  const insertRateHistory = db.prepare(
    'INSERT INTO rate_history (savings_box_id, rate_ea, start_date, end_date) VALUES (?, ?, ?, ?)'
  )

  function dateFmt(d: Date) { return d.toISOString().split('T')[0] }

  let totalInterestAll = 0

  for (let ci = 0; ci < cajitas.length; ci++) {
    const c = cajitas[ci]
    let balance = c.initialBalance
    let currentRate = c.rate
    let totalInterest = 0

    // Insert cajita with initial balance (will update to final later)
    const boxResult = insertBox.run(c.name, c.bank_id, c.initialBalance, c.goal, dateFmt(startDate))
    const boxId = Number(boxResult.lastInsertRowid)

    // Initial deposit movement
    insertMovement.run(boxId, 'deposit', c.initialBalance, 'Depósito inicial', dateFmt(startDate))

    // Initial rate history entry
    const rateEndDate = c.rateChange ? dateFmt(new Date(startDate.getTime() + c.rateChange.day * 86400000)) : null
    insertRateHistory.run(boxId, c.rate, dateFmt(startDate), rateEndDate)

    // If there's a rate change, add the new rate entry
    if (c.rateChange) {
      const changeDate = new Date(startDate.getTime() + c.rateChange.day * 86400000)
      insertRateHistory.run(boxId, c.rateChange.newRate, dateFmt(changeDate), null)
    }

    // Generate daily interest for each day
    for (let day = 1; day <= DAYS; day++) {
      const date = new Date(startDate.getTime() + day * 86400000)

      // Check if rate changed on this day
      if (c.rateChange && day === c.rateChange.day) {
        currentRate = c.rateChange.newRate
      }

      // Daily rate from EA: daily = (1 + EA/100)^(1/365) - 1
      const dailyRate = Math.pow(1 + currentRate / 100, 1 / 365) - 1
      const interest = Math.round(balance * dailyRate * 100) / 100

      balance += interest
      totalInterest += interest

      insertMovement.run(
        boxId, 'interest', interest,
        `Interés diario (${currentRate}% EA)`,
        dateFmt(date)
      )
    }

    // Update final balance with accrued interest
    db.prepare('UPDATE savings_boxes SET balance = ? WHERE id = ?').run(Math.round(balance), boxId)

    // If rate changed, update the bank to the final rate
    if (c.rateChange) {
      db.prepare('UPDATE banks SET rate_ea = ? WHERE id = ?').run(c.rateChange.newRate, c.bank_id)
    }

    totalInterestAll += totalInterest
    console.log(`   💰 ${c.name}: ${c.initialBalance.toLocaleString('es-CO')} → ${Math.round(balance).toLocaleString('es-CO')} (+$${Math.round(totalInterest).toLocaleString('es-CO')} interés, ${DAYS} días, ${currentRate}% EA)`)
  }

  // ==================== EXPENSES ====================
  const expenses = [
    { desc: 'Mercado semanal', amount: 185000, cur: 1, cat: 1, date: '2026-03-15', cop: 185000, rate: 1 },
    { desc: 'Netflix Premium', amount: 15.49, cur: 2, cat: 8, date: '2026-03-01', rec: true, freq: 'monthly', cop: 65500, rate: 4228.5 },
    { desc: 'Spotify Family', amount: 9.99, cur: 2, cat: 8, date: '2026-03-01', rec: true, freq: 'monthly', cop: 42250, rate: 4228.5 },
    { desc: 'Amazon Prime Video', amount: 4.99, cur: 2, cat: 8, date: '2026-03-01', rec: true, freq: 'monthly', cop: 21100, rate: 4228.5 },
    { desc: 'Internet Claro 300MB', amount: 89000, cur: 1, cat: 7, date: '2026-03-05', rec: true, freq: 'monthly', cop: 89000, rate: 1 },
    { desc: 'Gasolina', amount: 92000, cur: 1, cat: 2, date: '2026-03-12', cop: 92000, rate: 1 },
    { desc: 'Curso Udemy React', amount: 12.99, cur: 2, cat: 11, date: '2026-03-10', cop: 54900, rate: 4228.5 },
    { desc: 'Seguro de vida', amount: 45.00, cur: 2, cat: 9, date: '2026-03-01', rec: true, freq: 'monthly', cop: 190300, rate: 4228.5 },
    { desc: 'Vuelo Bogotá-Cartagena', amount: 320000, cur: 1, cat: 12, date: '2026-03-08', cop: 320000, rate: 1 },
    { desc: 'DigitalOcean VPS', amount: 24.00, cur: 2, cat: 15, date: '2026-03-01', rec: true, freq: 'monthly', cop: 101500, rate: 4228.5 },
    { desc: 'Dominio .com', amount: 12.00, cur: 2, cat: 15, date: '2026-01-15', rec: true, freq: 'yearly', cop: 50700, rate: 4228.5 },
    { desc: 'JetBrains All Products', amount: 24.90, cur: 3, cat: 16, date: '2026-03-01', rec: true, freq: 'monthly', cop: 115600, rate: 4642.2 },
  ]

  const insertExpense = db.prepare(`
    INSERT INTO expenses (description, amount, currency_id, amount_cop, exchange_rate, category_id, user_id, date, is_recurring, recurring_frequency, next_due_date)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
  `)

  for (const e of expenses) {
    let nextDue: string | null = null
    if (e.rec && e.freq) {
      const d = new Date(e.date)
      switch (e.freq) {
        case 'daily': d.setDate(d.getDate() + 1); break
        case 'weekly': d.setDate(d.getDate() + 7); break
        case 'monthly': d.setMonth(d.getMonth() + 1); break
        case 'yearly': d.setFullYear(d.getFullYear() + 1); break
      }
      nextDue = d.toISOString().split('T')[0]
    }
    insertExpense.run(
      e.desc, e.amount, e.cur, e.cop, e.rate,
      e.cat, e.date, e.rec ? 1 : 0, e.freq || null, nextDue,
    )
  }

  console.log('✅ Database seeded successfully')
  console.log(`   👤 User: robert / robert2026`)
  console.log(`   📁 ${categories.length} categories`)
  console.log(`   🏦 ${banks.length} banks`)
  console.log(`   💰 6 cajitas (${DAYS} días de interés diario)`)
  console.log(`   📈 Total interés acumulado: $${Math.round(totalInterestAll).toLocaleString('es-CO')}`)
  console.log(`   🧾 ${expenses.length} expenses (COP, USD, EUR)`)
}

seedDatabase().catch(console.error)
