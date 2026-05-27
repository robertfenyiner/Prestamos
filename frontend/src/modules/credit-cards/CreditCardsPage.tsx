import { useEffect, useState } from 'react'
import { CreditCard, Plus, Receipt, Wallet } from 'lucide-react'
import { currenciesAPI } from '@/lib/api'
import { creditCardsAPI } from './creditCardsApi'

const fmt = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')
const today = () => new Date().toISOString().slice(0, 10)

function Field({ label, children }: any) {
  return <label className="cc-field"><span>{label}</span>{children}</label>
}

export default function CreditCardsPage() {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [summary, setSummary] = useState<any>(null)
  const [cards, setCards] = useState<any[]>([])
  const [charges, setCharges] = useState<any[]>([])
  const [installments, setInstallments] = useState<any[]>([])
  const [currencies, setCurrencies] = useState<any[]>([])
  const [editingCardId, setEditingCardId] = useState<number | null>(null)
  const [showNewCard, setShowNewCard] = useState(false)
  const [editForm, setEditForm] = useState<any>({})

  const [cardForm, setCardForm] = useState({
    name: '', bank_name: '', country: 'Colombia', last_four: '', network: 'Visa', currency_id: 1,
    credit_limit: 0, interest_rate_monthly: 0, interest_rate_annual: 0, cut_day: 1, payment_due_day: 15, color: '#6366f1',
  })

  const [chargeForm, setChargeForm] = useState({
    card_id: '', description: '', amount: 0, currency_id: 1, purchase_date: today(), installments: 1, interest_rate_monthly: 0, notes: '',
  })

  const [paymentForm, setPaymentForm] = useState({
    card_id: '', amount: 0, currency_id: 1, payment_date: today(), payment_type: 'partial', notes: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const [s, c, ch, i, cur] = await Promise.all([
        creditCardsAPI.summary(), creditCardsAPI.cards(), creditCardsAPI.charges(), creditCardsAPI.installments(), currenciesAPI.list(),
      ])
      setSummary(s.data)
      setCards(c.data)
      setCharges(ch.data)
      setInstallments(i.data)
      setCurrencies(cur.data)
      if (c.data[0]) {
        setChargeForm(f => ({ ...f, card_id: String(c.data[0].id), currency_id: c.data[0].currency_id, interest_rate_monthly: c.data[0].interest_rate_monthly || 0 }))
        setPaymentForm(f => ({ ...f, card_id: String(c.data[0].id), currency_id: c.data[0].currency_id }))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const createCard = async () => {
    await creditCardsAPI.createCard(cardForm)
    setCardForm({ name: '', bank_name: '', country: 'Colombia', last_four: '', network: 'Visa', currency_id: 1, credit_limit: 0, interest_rate_monthly: 0, interest_rate_annual: 0, cut_day: 1, payment_due_day: 15, color: '#6366f1' })
    setShowNewCard(false)
    setMessage('Tarjeta creada')
    load()
  }

  const startEditCard = (card: any) => {
    setEditingCardId(card.id)
    setEditForm({
      credit_limit: card.credit_limit || 0,
      interest_rate_monthly: card.interest_rate_monthly || 0,
      interest_rate_annual: card.interest_rate_annual || 0,
      cut_day: card.cut_day || 1,
      payment_due_day: card.payment_due_day || 15,
      is_active: card.is_active !== 0,
    })
  }

  const saveEditCard = async () => {
    if (!editingCardId) return
    await creditCardsAPI.updateCard(editingCardId, editForm)
    setMessage('Tarjeta actualizada')
    setEditingCardId(null)
    setEditForm({})
    load()
  }

  const createCharge = async () => {
    await creditCardsAPI.createCharge({ ...chargeForm, card_id: Number(chargeForm.card_id) })
    setChargeForm(f => ({ ...f, description: '', amount: 0, installments: 1, notes: '' }))
    setMessage('Consumo registrado y gasto creado')
    load()
  }

  const createPayment = async () => {
    const r = await creditCardsAPI.createPayment({ ...paymentForm, card_id: Number(paymentForm.card_id) })
    const allocation = r.data?.allocation
    const detail = allocation ? ` Aplicado: ${fmt(allocation.applied)}${allocation.unapplied > 0 ? `, sin aplicar: ${fmt(allocation.unapplied)}` : ''}` : ''
    setPaymentForm(f => ({ ...f, amount: 0, notes: '' }))
    setMessage(`Pago registrado.${detail}`)
    load()
  }

  if (loading) return <div style={{ padding: 40 }}>Cargando tarjetas...</div>

  return (
    <div className="animate-fade-in cc-page">
      <div className="cc-header">
        <div>
          <h1 className="page-title">Tarjetas de Crédito</h1>
          <p className="page-subtitle">Controla tarjetas, consumos, cuotas, pagos y próximos vencimientos</p>
        </div>
        <button className="btn btn-primary cc-add-btn" onClick={() => setShowNewCard(!showNewCard)}><Plus size={16} /> {showNewCard ? 'Ocultar' : 'Nueva tarjeta'}</button>
      </div>

      {message && <div className="card cc-message">{message}</div>}

      <div className="cc-stats">
        <Stat title="Deuda estimada" value={fmt(summary?.totalDebt)} icon={<CreditCard />} />
        <Stat title="Cupo total" value={fmt(summary?.totalLimit)} icon={<Wallet />} />
        <Stat title="Cupo disponible" value={fmt(summary?.availableLimit)} icon={<Wallet />} />
        <Stat title="Cuotas próximas" value={summary?.upcoming?.length || 0} icon={<Receipt />} />
      </div>

      <Panel title="Mis tarjetas">
        <div className="cards-list">
          {cards.map(c => {
            const available = Number(c.credit_limit || 0) - Number(c.pending_balance || 0)
            return <div key={c.id} className="credit-card-item">
              <div className="credit-card-top">
                <div>
                  <strong>{c.name} {c.last_four ? `*${c.last_four}` : ''}</strong>
                  <span>{c.bank_name} · {c.country} · {c.currency_code}</span>
                </div>
                <button className="btn" onClick={() => editingCardId === c.id ? setEditingCardId(null) : startEditCard(c)}>{editingCardId === c.id ? 'Cerrar' : 'Editar'}</button>
              </div>
              <div className="card-metrics">
                <div><small>Cupo</small><b>{fmt(c.credit_limit)}</b></div>
                <div><small>Saldo</small><b>{fmt(c.pending_balance)}</b></div>
                <div><small>Disponible</small><b>{fmt(available)}</b></div>
                <div><small>Corte / pago</small><b>{c.cut_day} / {c.payment_due_day}</b></div>
              </div>
              {editingCardId === c.id && <div className="edit-grid labeled">
                <Field label="Cupo total"><input className="input" type="number" value={editForm.credit_limit} onChange={e => setEditForm({ ...editForm, credit_limit: Number(e.target.value) })} /></Field>
                <Field label="Tasa mensual %"><input className="input" type="number" value={editForm.interest_rate_monthly} onChange={e => setEditForm({ ...editForm, interest_rate_monthly: Number(e.target.value) })} /></Field>
                <Field label="Día de corte"><input className="input" type="number" value={editForm.cut_day} onChange={e => setEditForm({ ...editForm, cut_day: Number(e.target.value) })} /></Field>
                <Field label="Día límite de pago"><input className="input" type="number" value={editForm.payment_due_day} onChange={e => setEditForm({ ...editForm, payment_due_day: Number(e.target.value) })} /></Field>
                <button className="btn btn-primary" onClick={saveEditCard}>Guardar cambios</button>
                <button className="btn" onClick={() => setEditingCardId(null)}>Cancelar</button>
              </div>}
            </div>
          })}
          {!cards.length && <p>No hay tarjetas registradas.</p>}
        </div>
      </Panel>

      {showNewCard && <Panel title="Nueva tarjeta">
        <div className="form-grid">
          <Field label="Nombre"><input className="input" placeholder="Davivienda Visa" value={cardForm.name} onChange={e => setCardForm({ ...cardForm, name: e.target.value })} /></Field>
          <Field label="Banco"><input className="input" placeholder="Davivienda" value={cardForm.bank_name} onChange={e => setCardForm({ ...cardForm, bank_name: e.target.value })} /></Field>
          <Field label="País"><select className="input" value={cardForm.country} onChange={e => setCardForm({ ...cardForm, country: e.target.value })}><option>Colombia</option><option>Turquía</option><option>Nigeria</option><option>Otro</option></select></Field>
          <Field label="Últimos 4 dígitos"><input className="input" placeholder="6146" value={cardForm.last_four} onChange={e => setCardForm({ ...cardForm, last_four: e.target.value })} /></Field>
          <Field label="Moneda"><select className="input" value={cardForm.currency_id} onChange={e => setCardForm({ ...cardForm, currency_id: Number(e.target.value) })}>{currencies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select></Field>
          <Field label="Cupo"><input className="input" type="number" value={cardForm.credit_limit} onChange={e => setCardForm({ ...cardForm, credit_limit: Number(e.target.value) })} /></Field>
          <Field label="Tasa mensual %"><input className="input" type="number" value={cardForm.interest_rate_monthly} onChange={e => setCardForm({ ...cardForm, interest_rate_monthly: Number(e.target.value) })} /></Field>
          <Field label="Día de corte"><input className="input" type="number" value={cardForm.cut_day} onChange={e => setCardForm({ ...cardForm, cut_day: Number(e.target.value) })} /></Field>
          <Field label="Día límite de pago"><input className="input" type="number" value={cardForm.payment_due_day} onChange={e => setCardForm({ ...cardForm, payment_due_day: Number(e.target.value) })} /></Field>
        </div>
        <button className="btn btn-primary" onClick={createCard}><Plus size={16} /> Crear tarjeta</button>
      </Panel>}

      <div className="cc-grid two">
        <Panel title="Registrar consumo con tarjeta">
          <Field label="Tarjeta"><select className="input" value={chargeForm.card_id} onChange={e => setChargeForm({ ...chargeForm, card_id: e.target.value })}>{cards.map(c => <option key={c.id} value={c.id}>{c.name} - {c.bank_name}</option>)}</select></Field>
          <Field label="Descripción"><input className="input" placeholder="YouTube Family" value={chargeForm.description} onChange={e => setChargeForm({ ...chargeForm, description: e.target.value })} /></Field>
          <Field label="Monto"><input className="input" type="number" value={chargeForm.amount} onChange={e => setChargeForm({ ...chargeForm, amount: Number(e.target.value) })} /></Field>
          <Field label="Moneda"><select className="input" value={chargeForm.currency_id} onChange={e => setChargeForm({ ...chargeForm, currency_id: Number(e.target.value) })}>{currencies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select></Field>
          <Field label="Fecha de compra"><input className="input" type="date" value={chargeForm.purchase_date} onChange={e => setChargeForm({ ...chargeForm, purchase_date: e.target.value })} /></Field>
          <div className="mini-grid">
            <Field label="Cuotas"><input className="input" type="number" min={1} value={chargeForm.installments} onChange={e => setChargeForm({ ...chargeForm, installments: Number(e.target.value) })} /></Field>
            <Field label="Interés mensual %"><input className="input" type="number" value={chargeForm.interest_rate_monthly} onChange={e => setChargeForm({ ...chargeForm, interest_rate_monthly: Number(e.target.value) })} /></Field>
          </div>
          <button className="btn btn-primary" onClick={createCharge} disabled={!cards.length}>Registrar consumo</button>
        </Panel>

        <Panel title="Registrar pago">
          <Field label="Tarjeta"><select className="input" value={paymentForm.card_id} onChange={e => setPaymentForm({ ...paymentForm, card_id: e.target.value })}>{cards.map(c => <option key={c.id} value={c.id}>{c.name} - {c.bank_name}</option>)}</select></Field>
          <Field label="Monto pagado"><input className="input" type="number" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} /></Field>
          <Field label="Moneda"><select className="input" value={paymentForm.currency_id} onChange={e => setPaymentForm({ ...paymentForm, currency_id: Number(e.target.value) })}>{currencies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select></Field>
          <Field label="Tipo de pago"><select className="input" value={paymentForm.payment_type} onChange={e => setPaymentForm({ ...paymentForm, payment_type: e.target.value })}><option value="partial">Parcial</option><option value="minimum">Mínimo</option><option value="full">Total</option><option value="advance">Anticipo</option></select></Field>
          <Field label="Fecha de pago"><input className="input" type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} /></Field>
          <button className="btn btn-primary" onClick={createPayment} disabled={!cards.length}>Registrar pago y aplicar a cuotas</button>
        </Panel>
      </div>

      <Panel title="Próximas cuotas">
        {installments.slice(0, 8).map(i => <div key={i.id} className="cc-row"><strong>{i.description}</strong><span>{i.card_name} · cuota {i.installment_number} · vence {i.due_date} · {i.status}</span><span>Saldo cuota: {fmt(i.remaining_amount ?? i.total_amount)}</span></div>)}
        {installments.length > 8 && <p className="cc-muted">Mostrando 8 de {installments.length} cuotas pendientes.</p>}
        {!installments.length && <p>No hay cuotas pendientes.</p>}
      </Panel>

      <Panel title="Últimos consumos">
        {charges.slice(0, 8).map(c => <div key={c.id} className="cc-row"><strong>{c.description}</strong><span>{c.card_name} · {c.purchase_date} · {c.installments} cuota(s)</span><span>{c.currency_symbol}{Number(c.amount).toLocaleString('es-CO')} {c.currency_code}</span></div>)}
      </Panel>

      <style>{`
        .cc-header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 20px; }
        .cc-add-btn { white-space: nowrap; display: flex; align-items: center; gap: 8px; }
        .cc-message { padding: 12px; margin-bottom: 16px; }
        .cc-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
        .cc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
        .cc-grid.two { grid-template-columns: 1fr 1fr; }
        .form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .mini-grid, .edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .cc-field { display: flex; flex-direction: column; gap: 6px; }
        .cc-field > span { font-size: 0.74rem; color: var(--color-text-muted); font-weight: 600; }
        .cards-list { display: flex; flex-direction: column; gap: 12px; }
        .credit-card-item { padding: 14px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-bg-elevated); }
        .credit-card-top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
        .credit-card-top div { display: flex; flex-direction: column; gap: 4px; }
        .credit-card-top span, .cc-muted { color: var(--color-text-muted); font-size: 0.82rem; }
        .card-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .card-metrics div { padding: 10px; border-radius: 10px; background: var(--color-bg-primary); display: flex; flex-direction: column; gap: 4px; }
        .card-metrics small { color: var(--color-text-muted); }
        .cc-row { display: flex; flex-direction: column; gap: 6px; padding: 10px 0; border-bottom: 1px solid var(--color-border); }
        @media (max-width: 900px) {
          .cc-header { flex-direction: column; }
          .cc-add-btn { width: 100%; justify-content: center; }
          .cc-stats, .cc-grid, .cc-grid.two, .form-grid, .mini-grid, .edit-grid, .card-metrics { grid-template-columns: 1fr; }
          .credit-card-top { flex-direction: column; }
          .credit-card-top .btn { width: 100%; }
        }
      `}</style>
    </div>
  )
}

function Stat({ title, value, icon }: any) {
  return <div className="card" style={{ padding: 18 }}><div style={{ color: 'var(--color-accent)', marginBottom: 8 }}>{icon}</div><p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{title}</p><h3 style={{ margin: 0 }}>{value}</h3></div>
}

function Panel({ title, children }: any) {
  return <div className="card" style={{ padding: 20, marginBottom: 16 }}><h3 style={{ marginTop: 0 }}>{title}</h3><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div></div>
}
