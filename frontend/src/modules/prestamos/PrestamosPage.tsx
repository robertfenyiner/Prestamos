import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle, Clock, Eye, Loader2, Pencil, Plus, RefreshCw, Search, Skull, Trash2 } from 'lucide-react'
import { clientesAPI, currenciesAPI, prestamosAPI, type LoanPayload } from '@/lib/api'

type Client = { id: number; name: string; phone?: string; status: string }
type Currency = { id: number; code: string; symbol: string }
type Loan = Record<string, any>
type Installment = Record<string, any>

type FormState = {
  client_id: number | ''
  currency_id: number
  principal_amount: number | ''
  interest_rate: number | ''
  installments_count: number
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
  start_date: string
  first_due_date: string
  late_fee_rate: number | ''
  notes: string
}

const today = new Date().toISOString().slice(0, 10)
const emptyForm: FormState = {
  client_id: '',
  currency_id: 1,
  principal_amount: '',
  interest_rate: 20,
  installments_count: 4,
  frequency: 'weekly',
  start_date: today,
  first_due_date: today,
  late_fee_rate: 0,
  notes: '',
}

const freqLabel: Record<string, string> = {
  daily: 'Diario',
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
}

function fmt(n: number | string | undefined, symbol = '$') {
  const value = Number(n || 0)
  return `${symbol}${value.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}

function fmtExact(n: number | string | undefined, symbol = '$') {
  const value = Number(n || 0)
  return `${symbol}${value.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(value?: string) {
  if (!value) return '—'
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

function statusLabel(status: string) {
  if (status === 'paid') return 'Pagado'
  if (status === 'cancelled') return 'Cancelado'
  if (status === 'partial') return 'Parcial'
  return 'Activo'
}

function daysLate(dueDate?: string): number {
  if (!dueDate) return 0
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : 0
}

export default function PrestamosPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'paid' | 'cancelled'>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>({ ...emptyForm })
  const [detailId, setDetailId] = useState<number | null>(null)
  const [installments, setInstallments] = useState<Installment[]>([])
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null)

  const fetchLoans = useCallback(async () => {
    setLoading(true)
    try {
      const res = await prestamosAPI.list({ search: search || undefined, status, limit: 100 })
      setLoans(res.data.loans)
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => {
    clientesAPI.list({ status: 'active', limit: 300 }).then(r => setClients(r.data.clients)).catch(console.error)
    currenciesAPI.list().then(r => setCurrencies(r.data)).catch(console.error)
  }, [])

  useEffect(() => {
    const timer = setTimeout(fetchLoans, 250)
    return () => clearTimeout(timer)
  }, [fetchLoans])

  const selectedCurrency = currencies.find(c => c.id === form.currency_id) || currencies[0] || { symbol: '$', code: 'COP' }
  const preview = useMemo(() => {
    const principal = Number(form.principal_amount || 0)
    const interest = principal * (Number(form.interest_rate || 0) / 100)
    const total = principal + interest
    const cuota = form.installments_count > 0 ? total / form.installments_count : 0
    return { interest, total, cuota }
  }, [form.principal_amount, form.interest_rate, form.installments_count])

  const createLoan = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!form.client_id || !form.principal_amount) return
    setSaving(true)
    try {
      const payload: LoanPayload = {
        client_id: Number(form.client_id),
        currency_id: form.currency_id,
        principal_amount: Number(form.principal_amount),
        interest_rate: Number(form.interest_rate || 0),
        installments_count: Number(form.installments_count),
        frequency: form.frequency,
        start_date: form.start_date,
        first_due_date: form.first_due_date,
        late_fee_rate: Number(form.late_fee_rate || 0),
        notes: form.notes || undefined,
      }
      await prestamosAPI.create(payload)
      setShowForm(false)
      setForm({ ...emptyForm })
      await fetchLoans()
    } finally {
      setSaving(false)
    }
  }

  const openDetail = async (loan: Loan) => {
    setDetailId(loan.id)
    const res = await prestamosAPI.detail(loan.id)
    setInstallments(res.data.installments || [])
  }

  const payInstallment = async (loanId: number, installment: Installment) => {
    const pending = Number(installment.total_amount) - Number(installment.paid_amount || 0)
    const raw = prompt('Monto recibido', String(Math.max(0, pending)))
    if (!raw) return
    const amount = Number(raw)
    if (!Number.isFinite(amount) || amount <= 0) return
    await prestamosAPI.pay(loanId, { installment_id: installment.id, amount, payment_date: today })
    await openDetail({ id: loanId })
    await fetchLoans()
  }

  const payTotalLoan = async (loan: Loan) => {
    const balance = Number(loan.balance || 0)
    if (!confirm(`💰 Liquidar préstamo de ${loan.client_name}\n\nSe registrará un pago total de $${balance.toLocaleString('es-CO')} y se marcarán TODAS las cuotas como pagadas.\n\n¿Continuar?`)) return
    try {
      const res = await prestamosAPI.payTotal(loan.id, { method: 'cash' })
      alert(res.data.message || 'Préstamo liquidado')
      await fetchLoans()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al liquidar el préstamo')
    }
  }

  const editLoan = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!editingLoan) return
    setSaving(true)
    try {
      await prestamosAPI.edit(editingLoan.id, {
        principal_amount: Number(form.principal_amount),
        interest_rate: Number(form.interest_rate || 0),
        installments_count: Number(form.installments_count),
        frequency: form.frequency,
        first_due_date: form.first_due_date,
        late_fee_rate: Number(form.late_fee_rate || 0),
        notes: form.notes || undefined,
      })
      setEditingLoan(null)
      setForm({ ...emptyForm })
      await fetchLoans()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al editar el préstamo')
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (loan: Loan) => {
    setEditingLoan(loan)
    setForm({
      client_id: loan.client_id,
      currency_id: loan.currency_id,
      principal_amount: Number(loan.principal_amount),
      interest_rate: Number(loan.interest_rate),
      installments_count: Number(loan.installments_count),
      frequency: loan.frequency,
      start_date: String(loan.start_date || '').slice(0, 10),
      first_due_date: String(loan.first_due_date || '').slice(0, 10),
      late_fee_rate: Number(loan.late_fee_rate || 0),
      notes: loan.notes || '',
    })
  }

  const renewLoan = async (loan: Loan) => {
    if (!confirm(`¿Renovar el préstamo #${loan.id} de ${loan.client_name}? Se creará un nuevo préstamo con los mismos datos (cliente, monto, interés, cuotas y frecuencia).`)) return
    try {
      const res = await prestamosAPI.renew(loan.id)
      alert(res.data.message || 'Préstamo renovado')
      await fetchLoans()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al renovar')
    }
  }

  const deleteHard = async (loan: Loan) => {
    const typed = prompt(`⚠️ ELIMINACIÓN PERMANENTE ⚠️\n\nSe borrará el préstamo #${loan.id} de ${loan.client_name}, todas sus cuotas y todos los pagos asociados.\n\nEsta acción NO se puede deshacer.\n\nPara confirmar, escribe el número de cliente "${loan.client_name}" y presiona Enter:`)
    if (typed !== loan.client_name) {
      if (typed !== null) alert('Nombre no coincide. No se eliminó el préstamo.')
      return
    }
    try {
      await prestamosAPI.deleteHard(loan.id)
      alert('Préstamo eliminado permanentemente')
      if (detailId === loan.id) setDetailId(null)
      await fetchLoans()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al eliminar')
    }
  }

  const currentLoan = loans.find(l => l.id === detailId)

  return (
    <div className="animate-fade-in prestamos-page">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Préstamos</h1>
          <p className="page-subtitle">Control de préstamos, cuotas, saldos y pagos.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancelar' : <><Plus size={16} /> Nuevo préstamo</>}
        </button>
      </div>

      {showForm && (
        <div className="card animate-fade-in" style={{ padding: 20, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '0.96rem' }}>➕ Registrar préstamo</h3>
          <form onSubmit={createLoan}>
            <div className="loan-form-grid">
              <div><label className="form-label">Cliente *</label><select className="input" required value={form.client_id} onChange={e => setForm({ ...form, client_id: Number(e.target.value) || '' })}><option value="">Seleccionar cliente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>)}</select></div>
              <div><label className="form-label">Valor prestado *</label><input className="input" type="number" min="1" required value={form.principal_amount} onChange={e => setForm({ ...form, principal_amount: Number(e.target.value) || '' })} /></div>
              <div><label className="form-label">Moneda</label><select className="input" value={form.currency_id} onChange={e => setForm({ ...form, currency_id: Number(e.target.value) })}>{currencies.map(c => <option key={c.id} value={c.id}>{c.code} ({c.symbol})</option>)}</select></div>
              <div><label className="form-label">Interés % total</label><input className="input" type="number" step="0.01" min="0" value={form.interest_rate} onChange={e => setForm({ ...form, interest_rate: Number(e.target.value) || '' })} /></div>
              <div><label className="form-label">Cuotas</label><input className="input" type="number" min="1" max="240" value={form.installments_count} onChange={e => setForm({ ...form, installments_count: Number(e.target.value) || 1 })} /></div>
              <div><label className="form-label">Frecuencia</label><select className="input" value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value as FormState['frequency'] })}><option value="daily">Diario</option><option value="weekly">Semanal</option><option value="biweekly">Quincenal</option><option value="monthly">Mensual</option></select></div>
              <div><label className="form-label">Inicio</label><input className="input" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><label className="form-label">Primera cuota</label><input className="input" type="date" value={form.first_due_date} onChange={e => setForm({ ...form, first_due_date: e.target.value })} /></div>
              <div><label className="form-label">Mora %</label><input className="input" type="number" step="0.01" min="0" value={form.late_fee_rate} onChange={e => setForm({ ...form, late_fee_rate: Number(e.target.value) || '' })} /></div>
              <div className="span-3"><label className="form-label">Notas</label><input className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Observaciones del préstamo" /></div>
            </div>
            <div className="preview-row">
              <span>Interés: <strong>{fmt(preview.interest, selectedCurrency.symbol)}</strong></span>
              <span>Total: <strong>{fmt(preview.total, selectedCurrency.symbol)}</strong></span>
              <span>Cuota aprox: <strong>{fmt(preview.cuota, selectedCurrency.symbol)}</strong></span>
              <button type="submit" className="btn btn-success" disabled={saving}>{saving && <Loader2 size={14} className="loading-spin" />}Crear préstamo</button>
            </div>
          </form>
        </div>
      )}

      <div className="card search-filter-row" style={{ padding: '12px 16px', marginBottom: 16 }}>
        <div className="search-input-wrapper"><Search size={16} className="search-input-icon" /><input className="input" placeholder="Buscar por cliente, teléfono o notas..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="input status-filter" value={status} onChange={e => setStatus(e.target.value as any)}><option value="all">Todos</option><option value="active">Activos</option><option value="paid">Pagados</option><option value="cancelled">Cancelados</option></select>
      </div>

      <div className="card prestamos-list-card">
        {loading ? <div className="empty-state"><Loader2 className="loading-spin" /> Cargando...</div> : loans.length === 0 ? <div className="empty-state">No hay préstamos todavía.</div> : (
          <div className="loan-grid">
            {loans.map(loan => (
              <div key={loan.id} className={`loan-card ${loan.status}`}>
                <div className="loan-top"><div><div className="loan-client">{loan.client_name}</div><div className="loan-meta">{loan.client_phone || 'Sin teléfono'} · {freqLabel[loan.frequency]}</div></div><span className={`badge badge-${loan.status === 'active' ? 'success' : 'warning'}`}>{statusLabel(loan.status)}</span></div>
                <div className="loan-values"><div><span>Prestado</span><strong>{fmt(loan.principal_amount, loan.currency_symbol)}</strong></div><div><span>Total</span><strong>{fmt(loan.total_amount, loan.currency_symbol)}</strong></div><div><span>Saldo</span><strong>{fmt(loan.balance, loan.currency_symbol)}</strong></div></div>
                <div className="loan-details"><span><CalendarDays size={13} /> {loan.installments_count} cuotas</span><span><Clock size={13} /> Primera: {fmtDate(loan.first_due_date)}</span>{Number(loan.overdue_count) > 0 && <span className="danger-text"><AlertTriangle size={13} /> {loan.overdue_count} vencida(s)</span>}</div>
                <div className="loan-actions">
                  <button className="btn btn-ghost" onClick={() => openDetail(loan)} title="Ver cuotas y pagos"><Eye size={13} /> Ver</button>
                  {loan.status === 'active' && (
                    <button className="btn btn-ghost" onClick={() => openEditModal(loan)} title="Editar préstamo"><Pencil size={13} /> Editar</button>
                  )}
                  {(loan.status === 'paid' || loan.status === 'cancelled') && (
                    <button className="btn btn-ghost" onClick={() => renewLoan(loan)} title="Renovar préstamo (crea uno nuevo con los mismos datos)" style={{ color: 'var(--color-success)' }}><RefreshCw size={13} /> Renovar</button>
                  )}
                  {loan.status === 'active' && (
                    <button className="btn btn-ghost" onClick={() => payTotalLoan(loan)} title="Liquidar préstamo de una sola vez" style={{ color: 'var(--color-success)' }}><CheckCircle size={13} /> Pago Total</button>
                  )}
                  <button className="btn btn-ghost danger-text" onClick={() => deleteHard(loan)} title="Eliminar permanentemente (acción irreversible)"><Skull size={13} /> Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {detailId && currentLoan && (
        <div className="modal-overlay" onClick={() => setDetailId(null)}>
          <div className="card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>Cuotas — {currentLoan.client_name}</h3>
                <p>{fmt(currentLoan.total_amount, currentLoan.currency_symbol)} · {currentLoan.installments_count} cuotas · Mora {Number(currentLoan.late_fee_rate || 0)}% diario</p>
              </div>
              <button className="icon-btn" onClick={() => setDetailId(null)}>×</button>
            </div>
            <div className="installments-list">
              {installments.map(i => {
                const pending = Number(i.total_amount) - Number(i.paid_amount || 0)
                const baseAmount = Number(i.total_amount) - Number(i.late_fee_amount || 0)
                const late = Number(i.late_fee_amount || 0)
                const lateDays = daysLate(i.due_date)
                const lateRate = Number(currentLoan.late_fee_rate || 0)
                const isOverdue = i.status !== 'paid' && i.status !== 'cancelled' && lateDays > 0 && lateRate > 0
                return (
                  <div key={i.id} className={`installment-row ${i.status} ${isOverdue ? 'has-late-fee' : ''}`}>
                    <div>
                      <strong>#{i.installment_number}</strong>
                      <span>{fmtDate(i.due_date)}</span>
                      {isOverdue && (
                        <span className="late-fee-tag">⏰ {lateDays} día{lateDays !== 1 ? 's' : ''} vencida</span>
                      )}
                    </div>
                    <div>
                      <span>Base</span>
                      <strong>{fmt(baseAmount, currentLoan.currency_symbol)}</strong>
                    </div>
                    {isOverdue ? (
                      <div className="late-fee-cell">
                        <span className="late-fee-label">⚠️ Mora</span>
                        <strong className="late-fee-amount">+{fmtExact(late, currentLoan.currency_symbol)}</strong>
                      </div>
                    ) : (
                      <div>
                        <span>Pagado</span>
                        <strong>{fmt(i.paid_amount, currentLoan.currency_symbol)}</strong>
                      </div>
                    )}
                    <div>
                      <span>Total</span>
                      <strong className={isOverdue ? 'total-with-late-fee' : ''}>{fmt(i.total_amount, currentLoan.currency_symbol)}</strong>
                    </div>
                    <div>
                      <span>Saldo</span>
                      <strong>{fmt(pending, currentLoan.currency_symbol)}</strong>
                    </div>
                    <span className="badge">{statusLabel(i.status)}</span>
                    {i.status !== 'paid' && i.status !== 'cancelled' && (
                      <button className="btn btn-success" onClick={() => payInstallment(currentLoan.id, i)}>Pagar</button>
                    )}
                    {isOverdue && (
                      <div className="late-fee-breakdown">
                        💡 Cálculo de mora: {fmtExact(baseAmount, currentLoan.currency_symbol)} (valor base) × {lateRate}% × {lateDays} día{lateDays !== 1 ? 's' : ''} = <strong>{fmtExact(late, currentLoan.currency_symbol)}</strong>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {editingLoan && (
        <div className="modal-overlay" onClick={() => !saving && setEditingLoan(null)}>
          <div className="card modal-content modal-content-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>✏️ Editar préstamo #{editingLoan.id}</h3>
                <p>{editingLoan.client_name} · {fmt(editingLoan.total_amount, editingLoan.currency_symbol)}</p>
              </div>
              <button className="icon-btn" onClick={() => setEditingLoan(null)} disabled={saving}>×</button>
            </div>
            <form onSubmit={editLoan}>
              <div className="loan-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <label className="form-label">Valor prestado *</label>
                  <input className="input" type="number" min="1" required value={form.principal_amount} onChange={e => setForm({ ...form, principal_amount: Number(e.target.value) || '' })} disabled={saving} />
                </div>
                <div>
                  <label className="form-label">Interés % total</label>
                  <input className="input" type="number" step="0.01" min="0" value={form.interest_rate} onChange={e => setForm({ ...form, interest_rate: Number(e.target.value) || '' })} disabled={saving} />
                </div>
                <div>
                  <label className="form-label">Cuotas</label>
                  <input className="input" type="number" min="1" max="240" value={form.installments_count} onChange={e => setForm({ ...form, installments_count: Number(e.target.value) || 1 })} disabled={saving} />
                </div>
                <div>
                  <label className="form-label">Frecuencia</label>
                  <select className="input" value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value as FormState['frequency'] })} disabled={saving}>
                    <option value="daily">Diario</option>
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quincenal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Primera cuota</label>
                  <input className="input" type="date" value={form.first_due_date} onChange={e => setForm({ ...form, first_due_date: e.target.value })} disabled={saving} />
                </div>
                <div>
                  <label className="form-label">Mora %</label>
                  <input className="input" type="number" step="0.01" min="0" value={form.late_fee_rate} onChange={e => setForm({ ...form, late_fee_rate: Number(e.target.value) || '' })} disabled={saving} />
                </div>
                <div className="span-2">
                  <label className="form-label">Notas</label>
                  <input className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} disabled={saving} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEditingLoan(null)} disabled={saving}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving && <Loader2 size={14} className="loading-spin" />} Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
