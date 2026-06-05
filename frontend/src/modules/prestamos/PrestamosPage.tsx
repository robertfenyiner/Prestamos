import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Clock, Eye, Loader2, Plus, Search, Trash2 } from 'lucide-react'
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

  const cancelLoan = async (loan: Loan) => {
    if (!confirm(`¿Cancelar préstamo de ${loan.client_name}?`)) return
    await prestamosAPI.cancel(loan.id)
    await fetchLoans()
  }

  const currentLoan = loans.find(l => l.id === detailId)

  return (
    <div className="animate-fade-in prestamos-page">
      <div className="prestamos-header">
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

      <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}><Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} /><input className="input" placeholder="Buscar por cliente, teléfono o notas..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} /></div>
        <select className="input" value={status} onChange={e => setStatus(e.target.value as any)} style={{ width: 160 }}><option value="all">Todos</option><option value="active">Activos</option><option value="paid">Pagados</option><option value="cancelled">Cancelados</option></select>
      </div>

      <div className="card prestamos-list-card">
        {loading ? <div className="empty-state"><Loader2 className="loading-spin" /> Cargando...</div> : loans.length === 0 ? <div className="empty-state">No hay préstamos todavía.</div> : (
          <div className="loan-grid">
            {loans.map(loan => (
              <div key={loan.id} className={`loan-card ${loan.status}`}>
                <div className="loan-top"><div><div className="loan-client">{loan.client_name}</div><div className="loan-meta">{loan.client_phone || 'Sin teléfono'} · {freqLabel[loan.frequency]}</div></div><span className={`badge badge-${loan.status === 'active' ? 'success' : 'warning'}`}>{statusLabel(loan.status)}</span></div>
                <div className="loan-values"><div><span>Prestado</span><strong>{fmt(loan.principal_amount, loan.currency_symbol)}</strong></div><div><span>Total</span><strong>{fmt(loan.total_amount, loan.currency_symbol)}</strong></div><div><span>Saldo</span><strong>{fmt(loan.balance, loan.currency_symbol)}</strong></div></div>
                <div className="loan-details"><span><CalendarDays size={13} /> {loan.installments_count} cuotas</span><span><Clock size={13} /> Primera: {fmtDate(loan.first_due_date)}</span>{Number(loan.overdue_count) > 0 && <span className="danger-text"><AlertTriangle size={13} /> {loan.overdue_count} vencida(s)</span>}</div>
                <div className="loan-actions"><button className="btn btn-ghost" onClick={() => openDetail(loan)}><Eye size={14} />Cuotas</button>{loan.status === 'active' && <button className="btn btn-ghost danger-text" onClick={() => cancelLoan(loan)}><Trash2 size={14} />Cancelar</button>}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {detailId && currentLoan && (
        <div className="modal-overlay" onClick={() => setDetailId(null)}>
          <div className="card modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><div><h3>Cuotas — {currentLoan.client_name}</h3><p>{fmt(currentLoan.total_amount, currentLoan.currency_symbol)} · {currentLoan.installments_count} cuotas</p></div><button className="icon-btn" onClick={() => setDetailId(null)}>×</button></div>
            <div className="installments-list">
              {installments.map(i => {
                const pending = Number(i.total_amount) - Number(i.paid_amount || 0)
                return <div key={i.id} className={`installment-row ${i.status}`}><div><strong>#{i.installment_number}</strong><span>{fmtDate(i.due_date)}</span></div><div><span>Total</span><strong>{fmt(i.total_amount, currentLoan.currency_symbol)}</strong></div><div><span>Pagado</span><strong>{fmt(i.paid_amount, currentLoan.currency_symbol)}</strong></div><div><span>Saldo</span><strong>{fmt(pending, currentLoan.currency_symbol)}</strong></div><span className="badge">{statusLabel(i.status)}</span>{i.status !== 'paid' && i.status !== 'cancelled' && <button className="btn btn-success" onClick={() => payInstallment(currentLoan.id, i)}>Pagar</button>}</div>
              })}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .loading-spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
        .prestamos-header { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:20px; }
        .form-label { display:block; font-size:.76rem; font-weight:500; color:var(--color-text-secondary); margin-bottom:4px; }
        .loan-form-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; }
        .span-3 { grid-column: span 3; }
        .preview-row { display:flex; align-items:center; justify-content:flex-end; gap:16px; flex-wrap:wrap; margin-top:14px; color:var(--color-text-secondary); font-size:.84rem; }
        .btn-ghost { background: var(--color-bg-elevated); border:1px solid var(--color-border); }
        .prestamos-list-card { padding:0; overflow:hidden; }
        .loan-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:12px; padding:14px; }
        .loan-card { border:1px solid var(--color-border); border-radius:var(--radius-md); padding:14px; background:var(--color-bg-elevated); }
        .loan-card.cancelled { opacity:.65; }
        .loan-top { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:12px; }
        .loan-client { font-weight:700; color:var(--color-text-primary); }
        .loan-meta { color:var(--color-text-muted); font-size:.74rem; margin-top:2px; }
        .loan-values { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:10px; }
        .loan-values div { padding:8px; background:var(--color-bg-primary); border-radius:8px; }
        .loan-values span, .installment-row span { display:block; color:var(--color-text-muted); font-size:.68rem; }
        .loan-values strong { color:var(--color-text-primary); font-size:.9rem; }
        .loan-details { display:flex; gap:12px; flex-wrap:wrap; color:var(--color-text-secondary); font-size:.78rem; }
        .loan-details span { display:flex; align-items:center; gap:4px; }
        .loan-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:12px; }
        .danger-text { color:var(--color-danger); }
        .empty-state { padding:42px 20px; text-align:center; color:var(--color-text-muted); display:flex; align-items:center; justify-content:center; gap:8px; }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.62); display:flex; align-items:center; justify-content:center; z-index:1000; padding:16px; }
        .modal-content { padding:20px; width:min(880px, 96vw); max-height:86vh; overflow:auto; }
        .modal-head { display:flex; justify-content:space-between; gap:12px; margin-bottom:12px; }
        .modal-head h3 { margin:0; } .modal-head p { margin:4px 0 0; color:var(--color-text-muted); font-size:.8rem; }
        .icon-btn { background:none; border:none; color:var(--color-text-muted); font-size:1.4rem; cursor:pointer; }
        .installments-list { display:grid; gap:8px; }
        .installment-row { display:grid; grid-template-columns:.7fr 1fr 1fr 1fr auto auto; gap:10px; align-items:center; padding:10px; border:1px solid var(--color-border); border-radius:8px; background:var(--color-bg-elevated); }
        .installment-row.paid { opacity:.7; }
        @media (max-width:900px){ .loan-grid{grid-template-columns:1fr}.loan-form-grid{grid-template-columns:1fr 1fr}.span-3{grid-column:span 2}.installment-row{grid-template-columns:1fr 1fr;}}
        @media (max-width:560px){ .loan-form-grid{grid-template-columns:1fr}.span-3{grid-column:span 1}.loan-values{grid-template-columns:1fr}.preview-row{justify-content:flex-start} }
      `}</style>
    </div>
  )
}
