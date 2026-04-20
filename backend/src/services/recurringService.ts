import db from '../database'
import { convertToCOP } from './currencyService'

export async function processDueRecurringExpenses() {
  console.log('🔄 Procesando gastos recurrentes vencidos para historial...')
  let processed = 0

  // Buscamos los gastos que son recurrentes y cuya fecha de vencimiento es hoy o ya pasó
  const dueExpenses = db.prepare(`
    SELECT e.*, cur.code as currency_code
    FROM expenses e
    JOIN currencies cur ON e.currency_id = cur.id
    WHERE e.is_recurring = 1 AND e.next_due_date IS NOT NULL AND e.next_due_date <= date('now')
  `).all() as any[]

  if (dueExpenses.length === 0) {
    return { message: 'No hay gastos recurrentes por procesar', processed: 0 }
  }

  const insertStmt = db.prepare(`
    INSERT INTO expenses (
      user_id, description, amount, currency_id, category_id, company_id, 
      date, is_recurring, recurring_frequency, next_due_date, notes, amount_cop, exchange_rate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
  `)

  const updateOldStmt = db.prepare(`
    UPDATE expenses 
    SET is_recurring = 0, next_due_date = NULL 
    WHERE id = ?
  `)

  const processAll = db.transaction(() => {
    for (const exp of dueExpenses) {
      try {
        // Calcular la conversión de moneda EXACTA al día de hoy para el nuevo periodo
        const { copAmount, exchangeRate } = convertToCOP(exp.amount, exp.currency_code)

        // Calcular el próximo vencimiento a partir de este (mensual, semanal, anual)
        let nextDueDateStr = ''
        if (exp.recurring_frequency === 'weekly') {
          nextDueDateStr = db.prepare(`SELECT date(?, '+7 days') as d`).get(exp.next_due_date) as any
        } else if (exp.recurring_frequency === 'yearly') {
          nextDueDateStr = db.prepare(`SELECT date(?, '+1 year') as d`).get(exp.next_due_date) as any
        } else {
          // por defecto 'monthly'
          nextDueDateStr = db.prepare(`SELECT date(?, '+1 month') as d`).get(exp.next_due_date) as any
        }

        const newNextDue = (nextDueDateStr as any).d

        // Insertar el NUEVO registro que representa el periodo actual
        insertStmt.run(
          exp.user_id,
          exp.description,
          exp.amount,
          exp.currency_id,
          exp.category_id,
          exp.company_id,
          exp.next_due_date, // El nuevo gasto lleva la fecha en que vencía
          exp.recurring_frequency,
          newNextDue,
          exp.notes,
          copAmount,
          exchangeRate
        )

        // Marcar el VIEJO registro como "histórico" quitándole la recurrencia
        updateOldStmt.run(exp.id)
        
        processed++
      } catch (err: any) {
        console.error(`Error procesando gasto recurrente ${exp.id}:`, err.message)
      }
    }
  })

  try {
    processAll()
    if (processed > 0) {
      console.log(`✅ ${processed} gastos recurrentes convertidos en histórico y renovados.`)
    }
  } catch (err: any) {
    console.error('❌ Error procesando transacciones:', err.message)
  }

  return { message: `Procesados ${processed} gastos recurrentes`, processed }
}
