import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Plus, Search, Receipt, ArrowDownRight,
  Calendar, Tag, Loader2, Trash2, X, RefreshCw,
  Pencil, Clock, Paperclip, Download, Image, FileText,
  Settings, ChevronDown, ChevronUp,
} from 'lucide-react'
import { gastosAPI, currenciesAPI, filesAPI, type ExpensePayload } from '@/lib/api'

/* ===== Helpers ===== */
function fmt(n: number, s = '$') { return s + n.toLocaleString('es-CO', { minimumFractionDigits: n < 1000 ? 2 : 0 }) }
function fmtDate(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) }

const FREQ: Record<string, string> = { daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual', yearly: 'Anual' }

// Auto-assign category icon based on name
const ICON_MAP: Record<string, string> = {
  aliment: '🍔', comida: '🍔', mercado: '🍔', transport: '🚗', salud: '❤️', entret: '🎬',
  compras: '🛒', servicios: '⚡', internet: '📶', telefo: '📶', stream: '📺', seguro: '🛡️',
  banco: '💳', tarjeta: '💳', educa: '📚', viaje: '✈️', hogar: '🏠', cuidado: '💇',
  hosting: '🌐', dominio: '🌐', software: '💻', licencia: '💻', mascota: '🐾', regalo: '🎁',
}
function autoIcon(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, icon] of Object.entries(ICON_MAP)) {
    if (lower.includes(key)) return icon
  }
  return '📋'
}

/* ===== Types ===== */
interface FormState {
  description: string; amount: number | ''; currency_id: number; category_id: number | ''; company_id: number | ''
  date: string; is_recurring: boolean; recurring_frequency: string; notes: string; custom_exchange_rate: number | ''
}
const emptyForm: FormState = {
  description: '', amount: '', currency_id: 1, category_id: '', company_id: '',
  date: new Date().toISOString().split('T')[0],
  is_recurring: false, recurring_frequency: 'monthly', notes: '', custom_exchange_rate: ''
}

/* ===== Component ===== */
export default function GastosPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [currencies, setCurrencies] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [totalCOP, setTotalCOP] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCompany, setFilterCompany] = useState<number | ''>('')
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>({ ...emptyForm })
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const scrollToForm = () => {
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  const [showCats, setShowCats] = useState(false)
  const [editCatId, setEditCatId] = useState<number | null>(null)
  const [catForm, setCatForm] = useState({ name: '', color: '#6366f1' })

  const [showComps, setShowComps] = useState(false)
  const [editCompId, setEditCompId] = useState<number | null>(null)
  const [compForm, setCompForm] = useState({ name: '', color: '#10b981' })

  const [filesExpenseId, setFilesExpenseId] = useState<number | null>(null)
  const [expenseFiles, setExpenseFiles] = useState<any[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const modalFileRef = useRef<HTMLInputElement>(null)

  const fetchExpenses = useCallback(() => {
    const params: any = { limit: 50 }
    if (searchTerm) params.search = searchTerm
    if (filterCompany) params.company = filterCompany
    gastosAPI.list(params).then(r => {
      setExpenses(r.data.expenses); setTotal(r.data.total); setTotalCOP(r.data.totalAmountCOP)
    }).catch(console.error).finally(() => setLoading(false))
  }, [searchTerm, filterCompany])

  const fetchCats = () => gastosAPI.categories().then(r => setCategories(r.data))
  const fetchComps = () => gastosAPI.companies().then(r => setCompanies(r.data))

  useEffect(() => {
    Promise.all([fetchCats(), fetchComps(), currenciesAPI.list().then(r => setCurrencies(r.data))]).catch(console.error)
    fetchExpenses()
  }, [])

  useEffect(() => { const t = setTimeout(fetchExpenses, 300); return () => clearTimeout(t) }, [searchTerm, fetchExpenses])

  /* Expense CRUD */
  const openCreate = () => { setEditingId(null); setForm({ ...emptyForm }); setPendingFiles([]); setShowForm(true); scrollToForm() }
  const openEdit = (e: any) => {
    setEditingId(e.id)
    setForm({ description: e.description, amount: e.amount, currency_id: e.currency_id, category_id: e.category_id || '', company_id: e.company_id || '',
      date: e.date, is_recurring: !!e.is_recurring, recurring_frequency: e.recurring_frequency || 'monthly', notes: e.notes || '', custom_exchange_rate: e.exchange_rate || '' })
    setPendingFiles([]); setShowForm(true); scrollToForm()
  }
  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const payload: ExpensePayload = {
      description: form.description, amount: Number(form.amount), currency_id: form.currency_id,
      category_id: form.category_id ? Number(form.category_id) : undefined,
      company_id: form.company_id ? Number(form.company_id) : undefined,
      date: form.date,
      is_recurring: form.is_recurring, recurring_frequency: form.is_recurring ? form.recurring_frequency : undefined,
      notes: form.notes || undefined,
      custom_exchange_rate: form.custom_exchange_rate ? Number(form.custom_exchange_rate) : undefined,
    }
    try {
      let expId = editingId
      if (editingId) { await gastosAPI.update(editingId, payload) }
      else { const r = await gastosAPI.create(payload); expId = r.data.id }
      if (pendingFiles.length > 0 && expId) await filesAPI.upload(expId, pendingFiles)
      setShowForm(false); setEditingId(null); setForm({ ...emptyForm }); setPendingFiles([]); fetchExpenses()
    } catch (err) { console.error(err) }
  }
  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este gasto?')) return
    await gastosAPI.delete(id).catch(console.error); fetchExpenses()
  }

  /* Files */
  const openFiles = async (expId: number) => {
    setFilesExpenseId(expId); const r = await filesAPI.list(expId); setExpenseFiles(r.data.files)
  }
  const uploadToExpense = async (files: FileList | null) => {
    if (!files || !filesExpenseId) return; setUploadingFiles(true)
    try { await filesAPI.upload(filesExpenseId, Array.from(files)); const r = await filesAPI.list(filesExpenseId); setExpenseFiles(r.data.files) }
    catch (e) { console.error(e) } setUploadingFiles(false)
  }
  const deleteFile = async (fId: number) => {
    if (!confirm('¿Eliminar archivo?')) return; await filesAPI.delete(fId)
    if (filesExpenseId) { const r = await filesAPI.list(filesExpenseId); setExpenseFiles(r.data.files) }
  }

  /* Categories */
  const saveCat = async () => {
    if (!catForm.name) return
    const icon = autoIcon(catForm.name)
    if (editCatId) { await gastosAPI.updateCategory(editCatId, { name: catForm.name, icon, color: catForm.color }) }
    else { await gastosAPI.createCategory({ name: catForm.name, icon, color: catForm.color }) }
    setCatForm({ name: '', color: '#6366f1' }); setEditCatId(null); fetchCats()
  }
  const deleteCat = async (id: number) => {
    if (!confirm('¿Eliminar categoría? Los gastos asociados pasarán a "Sin categoría".')) return
    await gastosAPI.deleteCategory(id); fetchCats()
  }

  /* Companies */
  const saveComp = async () => {
    if (!compForm.name) return
    if (editCompId) { await gastosAPI.updateCompany(editCompId, { name: compForm.name, color: compForm.color }) }
    else { await gastosAPI.createCompany({ name: compForm.name, color: compForm.color }) }
    setCompForm({ name: '', color: '#10b981' }); setEditCompId(null); fetchComps()
  }
  const deleteComp = async (id: number) => {
    if (!confirm('¿Eliminar empresa? Los gastos asociados quedarán sin empresa.')) return
    await gastosAPI.deleteCompany(id); fetchComps()
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <Loader2 size={28} className="loading-spin" style={{ color: 'var(--color-accent)' }} />
    </div>
  )

  return (
    <div className="animate-fade-in gastos-page">
      {/* Header */}
      <div className="gastos-header">
        <div>
          <h1 className="page-title">Gastos</h1>
          <p className="page-subtitle">Gestiona tus gastos en múltiples monedas</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => setShowComps(!showComps)}>
            <Settings size={15} /> <span className="hide-mobile">Empresas</span> {showComps ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button className="btn btn-ghost" onClick={() => setShowCats(!showCats)}>
            <Settings size={15} /> <span className="hide-mobile">Categorías</span> {showCats ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button className="btn btn-primary" onClick={showForm ? () => { setShowForm(false); setEditingId(null) } : openCreate}>
            {showForm ? <X size={16} /> : <Plus size={16} />} <span className="hide-mobile">{showForm ? 'Cancelar' : 'Nuevo Gasto'}</span>
          </button>
        </div>
      </div>

      {/* Categories Panel */}
      {showCats && (
        <div className="card animate-fade-in" style={{ padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '0.88rem', fontWeight: 600 }}>Gestionar Categorías</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'end' }}>
            <input className="input" placeholder="Nombre de categoría" value={catForm.name}
              onChange={e => setCatForm({ ...catForm, name: e.target.value })} style={{ width: 200 }} />
            <input type="color" value={catForm.color} onChange={e => setCatForm({ ...catForm, color: e.target.value })}
              style={{ width: 40, height: 36, border: 'none', cursor: 'pointer', borderRadius: 6 }} />
            <span style={{ fontSize: '1.2rem' }}>{autoIcon(catForm.name)}</span>
            <button className="btn btn-success" onClick={saveCat} style={{ padding: '6px 14px' }}>{editCatId ? 'Actualizar' : 'Crear'}</button>
            {editCatId && <button className="btn btn-ghost" onClick={() => { setEditCatId(null); setCatForm({ name: '', color: '#6366f1' }) }}>Cancelar</button>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {categories.map(c => (
              <span key={c.id} className="badge" style={{ background: c.color + '18', color: c.color, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={() => { setEditCatId(c.id); setCatForm({ name: c.name, color: c.color }) }}>
                {c.icon} {c.name}
                <button onClick={ev => { ev.stopPropagation(); deleteCat(c.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, marginLeft: 2, opacity: 0.6, display: 'inline-flex' }}><X size={12} /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Companies Panel */}
      {showComps && (
        <div className="card animate-fade-in" style={{ padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '0.88rem', fontWeight: 600 }}>Gestionar Empresas</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'end' }}>
            <input className="input" placeholder="Nombre de empresa" value={compForm.name}
              onChange={e => setCompForm({ ...compForm, name: e.target.value })} style={{ width: 200 }} />
            <input type="color" value={compForm.color} onChange={e => setCompForm({ ...compForm, color: e.target.value })}
              style={{ width: 40, height: 36, border: 'none', cursor: 'pointer', borderRadius: 6 }} />
            <button className="btn btn-success" onClick={saveComp} style={{ padding: '6px 14px' }}>{editCompId ? 'Actualizar' : 'Crear'}</button>
            {editCompId && <button className="btn btn-ghost" onClick={() => { setEditCompId(null); setCompForm({ name: '', color: '#10b981' }) }}>Cancelar</button>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {companies.map(c => (
              <span key={c.id} className="badge" style={{ background: c.color + '18', color: c.color, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={() => { setEditCompId(c.id); setCompForm({ name: c.name, color: c.color }) }}>
                {c.name}
                <button onClick={ev => { ev.stopPropagation(); deleteComp(c.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, marginLeft: 2, opacity: 0.6, display: 'inline-flex' }}><X size={12} /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <div ref={formRef} className="card animate-fade-in" style={{ padding: 20, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 600 }}>
            {editingId ? '✏️ Editar gasto' : '➕ Nuevo gasto'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div><label className="form-label">Descripción *</label>
                <input className="input" placeholder="Ej: Netflix Premium" required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div><label className="form-label">Monto *</label>
                <input className="input" type="number" step="0.01" min={0.01} required value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) || '' })} /></div>
              <div><label className="form-label">Moneda</label>
                <select className="input" value={form.currency_id} onChange={e => setForm({ ...form, currency_id: Number(e.target.value) })}>
                  {currencies.map((c: any) => <option key={c.id} value={c.id}>{c.code} ({c.symbol})</option>)}</select></div>
              <div><label className="form-label">Categoría</label>
                <select className="input" value={form.category_id} onChange={e => setForm({ ...form, category_id: Number(e.target.value) || '' })}>
                  <option value="">Sin categoría</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></div>
              <div><label className="form-label">Empresa</label>
                <select className="input" value={form.company_id} onChange={e => setForm({ ...form, company_id: Number(e.target.value) || '' })}>
                  <option value="">Personal</option>
                  {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            </div>
            <div className="form-row" style={{ marginTop: 12 }}>
              <div><label className="form-label">Fecha</label>
                <input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              {currencies.find(c => c.id === form.currency_id)?.code !== 'COP' && (
                <div><label className="form-label">Tasa Cambio (Opcional)</label>
                  <input className="input" type="number" step="0.0001" min={0.0001} placeholder="Auto" value={form.custom_exchange_rate} onChange={e => setForm({ ...form, custom_exchange_rate: Number(e.target.value) || '' })} style={{ width: 120 }} /></div>
              )}
              <label className="form-check">
                <input type="checkbox" checked={form.is_recurring} onChange={e => setForm({ ...form, is_recurring: e.target.checked })} /> Recurrente</label>
              {form.is_recurring && (
                <select className="input" style={{ width: 'auto', padding: '6px 10px' }} value={form.recurring_frequency} onChange={e => setForm({ ...form, recurring_frequency: e.target.value })}>
                  <option value="daily">Diario</option><option value="weekly">Semanal</option><option value="monthly">Mensual</option><option value="yearly">Anual</option></select>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="file" ref={fileRef} multiple accept="image/*,.pdf,.doc,.docx" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files) setPendingFiles(p => [...p, ...Array.from(e.target.files!)]) }} />
                <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}><Paperclip size={14} /> Adjuntar</button>
                {pendingFiles.length > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--color-accent)' }}>{pendingFiles.length}</span>}
              </div>
              <div style={{ flex: 1 }} />
              <button type="submit" className="btn btn-success">{editingId ? 'Guardar' : 'Crear'}</button>
            </div>
            {pendingFiles.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {pendingFiles.map((f, i) => (
                  <span key={i} className="file-chip">
                    {f.type.startsWith('image/') ? <Image size={11} /> : <FileText size={11} />}
                    {f.name.substring(0, 20)}{f.name.length > 20 ? '…' : ''}
                    <button type="button" onClick={() => setPendingFiles(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
          </form>
        </div>
      )}

      {/* Summary Cards */}
      <div className="stats-grid stagger-children" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="card stat-card"><div className="stat-icon" style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}><Receipt size={20} /></div>
          <div className="stat-label">Total (COP)</div><div className="stat-value">${totalCOP.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</div></div>
        <div className="card stat-card"><div className="stat-icon" style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}><Calendar size={20} /></div>
          <div className="stat-label">Transacciones</div><div className="stat-value">{total}</div></div>
      </div>

      {/* Search and Filters */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input className="input" placeholder="Buscar gastos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
        <select className="input" style={{ width: 180 }} value={filterCompany} onChange={e => setFilterCompany(Number(e.target.value) || '')}>
          <option value="">Todas las empresas</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Desktop Table */}
      <div className="card gastos-table-card">
        <table className="gastos-table">
          <thead>
            <tr>
              {['Descripción', 'Empresa', 'Categoría', 'Monto', 'COP', 'Fecha', 'Tipo', 'Próximo pago', ''].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expenses.map(g => (
              <tr key={g.id}>
                <td><div className="exp-desc"><div className="exp-icon-sm"><ArrowDownRight size={14} /></div>{g.description}</div></td>
                <td>{g.company_name ? <span className="badge" style={{ background: (g.company_color || '#10b981') + '18', color: g.company_color, fontSize: '0.7rem' }}>{g.company_name}</span> : <span className="text-muted text-xs">Personal</span>}</td>
                <td>{g.category_name ? <span className="badge" style={{ background: (g.category_color || '#6366f1') + '18', color: g.category_color, fontSize: '0.7rem' }}>{g.category_icon} {g.category_name}</span> : '—'}</td>
                <td><strong>{fmt(g.amount, g.currency_symbol)}</strong> <span className="text-xs text-muted">{g.currency_code}</span></td>
                <td>{g.currency_code === 'COP' ? '—' : g.amount_cop ? <><div className="text-sm">≈ ${g.amount_cop.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</div><div className="text-xxs text-muted">Tasa: {g.exchange_rate?.toFixed(2)}</div></> : <span className="text-xs" style={{ color: 'var(--color-warning)' }}>Sin conv.</span>}</td>
                <td className="text-sm text-muted nowrap">{fmtDate(g.date)}</td>
                <td>{g.is_recurring ? <span className="badge badge-accent text-xxs"><RefreshCw size={10} />{FREQ[g.recurring_frequency] || g.recurring_frequency}</span> : <span className="text-xs text-muted">Único</span>}</td>
                <td>{g.is_recurring && g.next_due_date ? <span className="text-sm" style={{ color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} />{fmtDate(g.next_due_date)}</span> : '—'}</td>
                <td className="actions-cell">
                  <button onClick={() => openFiles(g.id)} title="Adjuntos" className="icon-btn"><Paperclip size={14} /></button>
                  <button onClick={() => openEdit(g)} title="Editar" className="icon-btn accent"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(g.id)} title="Eliminar" className="icon-btn danger"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {expenses.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>No se encontraron gastos</div>}
      </div>

      {/* Mobile Cards */}
      <div className="gastos-mobile-cards">
        {expenses.map(g => (
          <div key={g.id} className="card gasto-card">
            <div className="gasto-card-top">
              <div className="exp-desc"><div className="exp-icon-sm"><ArrowDownRight size={14} /></div>
                <div>
                  <div className="gasto-card-name">{g.description}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                    {g.company_name && <span className="badge" style={{ background: (g.company_color || '#10b981') + '18', color: g.company_color, fontSize: '0.65rem' }}>{g.company_name}</span>}
                    {g.category_name && <span className="badge" style={{ background: (g.category_color || '#6366f1') + '18', color: g.category_color, fontSize: '0.65rem' }}>{g.category_icon} {g.category_name}</span>}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="gasto-card-amount">{fmt(g.amount, g.currency_symbol)} <span className="text-xxs text-muted">{g.currency_code}</span></div>
                {g.currency_code !== 'COP' && g.amount_cop && <div className="text-xxs text-muted">≈ ${g.amount_cop.toLocaleString('es-CO', { maximumFractionDigits: 0 })} COP</div>}
              </div>
            </div>
            <div className="gasto-card-bottom">
              <span className="text-xs text-muted">{fmtDate(g.date)}</span>
              {g.is_recurring ? (
                <span className="badge badge-accent text-xxs"><RefreshCw size={9} />{FREQ[g.recurring_frequency]}</span>
              ) : <span className="text-xxs text-muted">Único</span>}
              {g.is_recurring && g.next_due_date && <span className="text-xxs" style={{ color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: 2 }}><Clock size={10} />{fmtDate(g.next_due_date)}</span>}
              <div style={{ flex: 1 }} />
              <button onClick={() => openFiles(g.id)} className="icon-btn"><Paperclip size={14} /></button>
              <button onClick={() => openEdit(g)} className="icon-btn accent"><Pencil size={14} /></button>
              <button onClick={() => handleDelete(g.id)} className="icon-btn danger"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {expenses.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>No se encontraron gastos</div>}
      </div>

      {/* Files Modal */}
      {filesExpenseId !== null && (
        <div className="modal-overlay" onClick={() => setFilesExpenseId(null)}>
          <div className="card modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>📎 Archivos adjuntos</h3>
              <button onClick={() => setFilesExpenseId(null)} className="icon-btn"><X size={20} /></button>
            </div>
            <div className="upload-zone">
              <input type="file" ref={modalFileRef} multiple accept="image/*,.pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => uploadToExpense(e.target.files)} />
              <button className="btn btn-ghost" onClick={() => modalFileRef.current?.click()} disabled={uploadingFiles}>
                {uploadingFiles ? <Loader2 size={14} className="loading-spin" /> : <Plus size={14} />}
                {uploadingFiles ? 'Subiendo...' : 'Subir archivos'}
              </button>
              <p className="text-xxs text-muted" style={{ marginTop: 6 }}>Máx. 5, 10MB c/u • Imágenes, PDF, Office</p>
            </div>
            {expenseFiles.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '20px 0' }}>No hay archivos</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {expenseFiles.map((f: any) => (
                  <div key={f.id} className="file-row">
                    {f.isImage ? <Image size={18} style={{ color: 'var(--color-accent)', flexShrink: 0 }} /> : <FileText size={18} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="file-name">{f.originalName}</div>
                      <div className="text-xxs text-muted">{(f.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <a href={filesAPI.downloadUrl(f.id)} target="_blank" rel="noopener" title="Ver/Descargar" className="icon-btn accent"><Download size={16} /></a>
                    <button onClick={() => deleteFile(f.id)} title="Eliminar" className="icon-btn danger"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scoped Styles */}
      <style>{`
        .loading-spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .gastos-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 12px; flex-wrap: wrap; }
        .form-label { display: block; font-size: 0.76rem; font-weight: 500; color: var(--color-text-secondary); margin-bottom: 4px; }
        .form-grid { display: grid; grid-template-columns: 1.5fr 0.7fr 0.5fr 1fr 1fr; gap: 12px; align-items: end; }
        .form-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .form-check { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: var(--color-text-secondary); cursor: pointer; }
        .form-check input { accent-color: var(--color-accent); }

        .btn-ghost { background: var(--color-bg-elevated); border: 1px solid var(--color-border); }
        .icon-btn { padding: 4px; background: none; border: none; cursor: pointer; color: var(--color-text-muted); display: inline-flex; align-items: center; }
        .icon-btn.accent { color: var(--color-accent); }
        .icon-btn.danger { color: var(--color-danger); }
        .icon-btn:hover { opacity: 0.7; }

        .text-xs { font-size: 0.75rem; }
        .text-xxs { font-size: 0.68rem; }
        .text-sm { font-size: 0.82rem; }
        .text-muted { color: var(--color-text-muted); }
        .nowrap { white-space: nowrap; }

        .exp-desc { display: flex; align-items: center; gap: 8px; }
        .exp-icon-sm { width: 28px; height: 28px; border-radius: 6px; background: var(--color-danger-soft); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--color-danger); }

        .file-chip { font-size: 0.72rem; padding: 3px 8px; border-radius: 4px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); display: inline-flex; align-items: center; gap: 4px; }

        .stats-grid { grid-template-columns: repeat(3, 1fr) !important; }
        .stat-value { font-size: 1.3rem !important; }

        /* ===== Table (desktop only) ===== */
        .gastos-table-card { padding: 0; overflow: auto; }
        .gastos-table { width: 100%; border-collapse: collapse; }
        .gastos-table th { padding: 10px 12px; text-align: left; font-size: 0.7rem; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; border-bottom: 1px solid var(--color-border); }
        .gastos-table td { padding: 10px 12px; font-size: 0.84rem; }
        .gastos-table tr { border-bottom: 1px solid var(--color-border-light); transition: background var(--transition-fast); }
        .gastos-table tbody tr:hover { background: var(--color-bg-hover); }
        .actions-cell { text-align: right; white-space: nowrap; }

        /* ===== Mobile cards (hidden on desktop) ===== */
        .gastos-mobile-cards { display: none; }
        .gasto-card { padding: 14px; margin-bottom: 10px; }
        .gasto-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .gasto-card-name { font-size: 0.88rem; font-weight: 600; color: var(--color-text-primary); }
        .gasto-card-amount { font-size: 0.92rem; font-weight: 700; color: var(--color-text-primary); }
        .gasto-card-bottom { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--color-border-light); flex-wrap: wrap; }

        /* ===== Modal ===== */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
        .modal-content { padding: 24px; max-width: 520px; width: 100%; max-height: 80vh; overflow: auto; }
        .upload-zone { padding: 16px; border: 2px dashed var(--color-border); border-radius: 8px; text-align: center; }
        .file-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); }
        .file-name { font-size: 0.82rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: 1fr 1fr 1fr !important; gap: 8px !important; }
          .stat-value { font-size: 1.1rem !important; }
          .stat-label { font-size: 0.68rem !important; }
          .form-grid { grid-template-columns: 1fr 1fr; }
          .hide-mobile { display: none; }
          .gastos-table-card { display: none !important; }
          .gastos-mobile-cards { display: block; }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr !important; }
          .form-grid { grid-template-columns: 1fr; }
          .form-row { gap: 8px; }
          .gastos-header { flex-direction: column; }
        }
      `}</style>
    </div>
  )
}
