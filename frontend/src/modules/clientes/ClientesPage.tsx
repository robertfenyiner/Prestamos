import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, UserRound, Pencil, Trash2, X, Loader2, Phone, MapPin, IdCard, Users } from 'lucide-react'
import { clientesAPI, type ClientPayload } from '@/lib/api'

type Client = ClientPayload & {
  id: number
  created_at: string
  updated_at: string
}

type FormState = Required<Omit<ClientPayload, 'status'>> & { status: 'active' | 'inactive' }

const emptyForm: FormState = {
  name: '',
  document: '',
  phone: '',
  alternate_phone: '',
  address: '',
  reference_name: '',
  reference_phone: '',
  notes: '',
  status: 'active',
}

function cleanPayload(form: FormState): ClientPayload {
  return {
    name: form.name.trim(),
    document: form.document.trim() || undefined,
    phone: form.phone.trim() || undefined,
    alternate_phone: form.alternate_phone.trim() || undefined,
    address: form.address.trim() || undefined,
    reference_name: form.reference_name.trim() || undefined,
    reference_phone: form.reference_phone.trim() || undefined,
    notes: form.notes.trim() || undefined,
    status: form.status,
  }
}

function fmtDate(value?: string) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>({ ...emptyForm })

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const res = await clientesAPI.list({ search: search || undefined, status, limit: 200 })
      setClients(res.data.clients)
      setSummary({
        total: res.data.summary?.total || 0,
        active: res.data.summary?.active || 0,
        inactive: res.data.summary?.inactive || 0,
      })
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => {
    const timer = setTimeout(fetchClients, 250)
    return () => clearTimeout(timer)
  }, [fetchClients])

  const visibleTitle = useMemo(() => {
    if (status === 'active') return 'Clientes activos'
    if (status === 'inactive') return 'Clientes inactivos'
    return 'Todos los clientes'
  }, [status])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...emptyForm })
    setShowForm(true)
  }

  const openEdit = (client: Client) => {
    setEditingId(client.id)
    setForm({
      name: client.name || '',
      document: client.document || '',
      phone: client.phone || '',
      alternate_phone: client.alternate_phone || '',
      address: client.address || '',
      reference_name: client.reference_name || '',
      reference_phone: client.reference_phone || '',
      notes: client.notes || '',
      status: client.status || 'active',
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm({ ...emptyForm })
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const payload = cleanPayload(form)
      if (editingId) await clientesAPI.update(editingId, payload)
      else await clientesAPI.create(payload)
      closeForm()
      await fetchClients()
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async (client: Client) => {
    if (!confirm(`¿Desactivar a ${client.name}? No se borra, solo queda inactivo.`)) return
    await clientesAPI.deactivate(client.id)
    await fetchClients()
  }

  return (
    <div className="animate-fade-in clientes-page">
      <div className="clientes-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">Crea, edita y controla los datos básicos de cada cliente.</p>
        </div>
        <button className="btn btn-primary" onClick={showForm ? closeForm : openCreate}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancelar' : 'Nuevo cliente'}
        </button>
      </div>

      <div className="stats-grid clientes-stats">
        <div className="card stat-card"><div className="stat-icon" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}><Users size={20} /></div><div className="stat-label">Total</div><div className="stat-value">{summary.total}</div></div>
        <div className="card stat-card"><div className="stat-icon" style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)' }}><UserRound size={20} /></div><div className="stat-label">Activos</div><div className="stat-value">{summary.active}</div></div>
        <div className="card stat-card"><div className="stat-icon" style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}><UserRound size={20} /></div><div className="stat-label">Inactivos</div><div className="stat-value">{summary.inactive}</div></div>
      </div>

      {showForm && (
        <div className="card animate-fade-in" style={{ padding: 20, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: 700 }}>{editingId ? '✏️ Editar cliente' : '➕ Nuevo cliente'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="client-form-grid">
              <div><label className="form-label">Nombre *</label><input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nombre completo" /></div>
              <div><label className="form-label">Documento</label><input className="input" value={form.document} onChange={e => setForm({ ...form, document: e.target.value })} placeholder="Cédula / ID" /></div>
              <div><label className="form-label">Teléfono</label><input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Número principal" /></div>
              <div><label className="form-label">Teléfono alterno</label><input className="input" value={form.alternate_phone} onChange={e => setForm({ ...form, alternate_phone: e.target.value })} placeholder="Opcional" /></div>
              <div className="span-2"><label className="form-label">Dirección</label><input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Dirección / barrio" /></div>
              <div><label className="form-label">Referencia</label><input className="input" value={form.reference_name} onChange={e => setForm({ ...form, reference_name: e.target.value })} placeholder="Nombre referencia" /></div>
              <div><label className="form-label">Tel. referencia</label><input className="input" value={form.reference_phone} onChange={e => setForm({ ...form, reference_phone: e.target.value })} placeholder="Teléfono referencia" /></div>
              <div><label className="form-label">Estado</label><select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></div>
              <div className="span-2"><label className="form-label">Notas</label><textarea className="input" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Observaciones, referencias o detalles importantes" /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button type="button" className="btn btn-ghost" onClick={closeForm}>Cancelar</button>
              <button type="submit" className="btn btn-success" disabled={saving}>{saving ? <Loader2 size={14} className="loading-spin" /> : null}{editingId ? 'Guardar cambios' : 'Crear cliente'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input className="input" placeholder="Buscar por nombre, documento, teléfono o dirección..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
        <select className="input" value={status} onChange={e => setStatus(e.target.value as 'all' | 'active' | 'inactive')} style={{ width: 170 }}>
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      <div className="card clientes-list-card">
        <div className="list-header"><strong>{visibleTitle}</strong><span>{clients.length} mostrado(s)</span></div>
        {loading ? (
          <div className="empty-state"><Loader2 size={24} className="loading-spin" /> Cargando clientes...</div>
        ) : clients.length === 0 ? (
          <div className="empty-state">No hay clientes todavía. Crea el primero para empezar el control de préstamos.</div>
        ) : (
          <div className="client-grid">
            {clients.map(client => (
              <div key={client.id} className={`client-card ${client.status === 'inactive' ? 'inactive' : ''}`}>
                <div className="client-top">
                  <div className="client-avatar"><UserRound size={18} /></div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="client-name">{client.name}</div>
                    <div className="client-meta">Creado: {fmtDate(client.created_at)}</div>
                  </div>
                  <span className={`badge ${client.status === 'active' ? 'badge-success' : 'badge-warning'}`}>{client.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                </div>
                <div className="client-details">
                  <div><IdCard size={13} /> {client.document || 'Sin documento'}</div>
                  <div><Phone size={13} /> {client.phone || 'Sin teléfono'}</div>
                  <div><MapPin size={13} /> {client.address || 'Sin dirección'}</div>
                  {client.reference_name && <div><Users size={13} /> Ref: {client.reference_name}{client.reference_phone ? ` — ${client.reference_phone}` : ''}</div>}
                </div>
                {client.notes && <div className="client-notes">{client.notes}</div>}
                <div className="client-actions">
                  <button className="btn btn-ghost" onClick={() => openEdit(client)}><Pencil size={14} />Editar</button>
                  {client.status === 'active' && <button className="btn btn-ghost danger-text" onClick={() => deactivate(client)}><Trash2 size={14} />Desactivar</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .loading-spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .clientes-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
        .clientes-stats { grid-template-columns: repeat(3, 1fr) !important; }
        .form-label { display: block; font-size: 0.76rem; font-weight: 500; color: var(--color-text-secondary); margin-bottom: 4px; }
        .client-form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .span-2 { grid-column: span 2; }
        .btn-ghost { background: var(--color-bg-elevated); border: 1px solid var(--color-border); }
        .danger-text { color: var(--color-danger); }
        .clientes-list-card { padding: 0; overflow: hidden; }
        .list-header { padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); color: var(--color-text-secondary); font-size: 0.86rem; }
        .list-header span { color: var(--color-text-muted); font-size: 0.76rem; }
        .empty-state { padding: 42px 20px; text-align: center; color: var(--color-text-muted); display: flex; align-items: center; justify-content: center; gap: 8px; }
        .client-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 14px; }
        .client-card { border: 1px solid var(--color-border); background: var(--color-bg-elevated); border-radius: var(--radius-md); padding: 14px; }
        .client-card.inactive { opacity: 0.72; }
        .client-top { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .client-avatar { width: 36px; height: 36px; border-radius: 10px; background: var(--color-accent-soft); color: var(--color-accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .client-name { font-size: 0.96rem; font-weight: 700; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .client-meta { font-size: 0.7rem; color: var(--color-text-muted); margin-top: 2px; }
        .client-details { display: grid; gap: 6px; color: var(--color-text-secondary); font-size: 0.8rem; }
        .client-details div { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .client-notes { margin-top: 10px; padding: 8px; border-radius: 8px; background: var(--color-bg-primary); color: var(--color-text-muted); font-size: 0.76rem; }
        .client-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
        @media (max-width: 900px) { .client-grid { grid-template-columns: 1fr; } .client-form-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 560px) { .clientes-stats { grid-template-columns: 1fr !important; } .client-form-grid { grid-template-columns: 1fr; } .span-2 { grid-column: span 1; } }
      `}</style>
    </div>
  )
}
