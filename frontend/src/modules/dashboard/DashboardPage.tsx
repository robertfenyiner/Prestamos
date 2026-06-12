import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  Clock,
  Loader2,
  Plus,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'
import { clientesAPI, prestamosAPI } from '@/lib/api'

type Loan = Record<string, any>
type Client = Record<string, any>

type DashboardState = {
  loans: Loan[]
  loanSummary: Record<string, any>
  clients: Client[]
  clientSummary: Record<string, any>
}

function formatCOP(value: number | string | undefined) {
  const number = Number(value || 0)
  return '$' + Math.abs(number).toLocaleString('es-CO', { maximumFractionDigits: 0 })
}

function formatDate(value?: string) {
  if (!value) return '—'
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  })
}

function statusLabel(status: string) {
  if (status === 'paid') return 'Pagado'
  if (status === 'cancelled') return 'Cancelado'
  if (status === 'partial') return 'Parcial'
  return 'Activo'
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardState>({ loans: [], loanSummary: {}, clients: [], clientSummary: {} })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      prestamosAPI.list({ status: 'all', limit: 200 }),
      clientesAPI.list({ status: 'all', limit: 300 }),
    ])
      .then(([loansRes, clientsRes]) => {
        setData({
          loans: loansRes.data.loans || [],
          loanSummary: loansRes.data.summary || {},
          clients: clientsRes.data.clients || [],
          clientSummary: clientsRes.data.summary || {},
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const computed = useMemo(() => {
    const activeLoans = data.loans.filter(loan => loan.status === 'active')
    const overdueLoans = activeLoans.filter(loan => Number(loan.overdue_count || 0) > 0)
    const paidLoans = data.loans.filter(loan => loan.status === 'paid')
    const totalBalance = activeLoans.reduce((sum, loan) => sum + Number(loan.balance || 0), 0)
    const recentLoans = [...data.loans].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 5)
    const priorityLoans = [...activeLoans]
      .sort((a, b) => Number(b.overdue_count || 0) - Number(a.overdue_count || 0) || String(a.first_due_date || '').localeCompare(String(b.first_due_date || '')))
      .slice(0, 5)

    return { activeLoans, overdueLoans, paidLoans, totalBalance, recentLoans, priorityLoans }
  }, [data.loans])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-accent)' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const stats = [
    {
      label: 'Capital Activo',
      value: formatCOP(data.loanSummary.active_principal),
      change: `${computed.activeLoans.length} préstamo(s) activo(s)`,
      positive: true,
      icon: CircleDollarSign,
      color: 'var(--color-accent)',
      bg: 'var(--color-accent-soft)',
    },
    {
      label: 'Total a Cobrar',
      value: formatCOP(data.loanSummary.active_total),
      change: `Saldo pendiente ${formatCOP(computed.totalBalance)}`,
      positive: true,
      icon: Wallet,
      color: 'var(--color-success)',
      bg: 'var(--color-success-soft)',
    },
    {
      label: 'Préstamos Vencidos',
      value: String(computed.overdueLoans.length),
      change: 'Con cuotas vencidas',
      positive: computed.overdueLoans.length === 0,
      icon: AlertTriangle,
      color: 'var(--color-warning)',
      bg: 'var(--color-warning-soft)',
    },
    {
      label: 'Cuotas Vencidas',
      value: String(data.loanSummary.overdue_installments || 0),
      change: 'Pendientes fuera de fecha',
      positive: Number(data.loanSummary.overdue_installments || 0) === 0,
      icon: Clock,
      color: 'var(--color-danger)',
      bg: 'var(--color-danger-soft)',
    },
  ]

  return (
    <div className="animate-fade-in dashboard-prestamos">
      <div className="page-header dashboard-top">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Resumen operativo de préstamos — {new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="dashboard-actions">
          <Link className="btn btn-primary" to="/prestamos"><Plus size={16} /> Nuevo préstamo</Link>
          <Link className="btn btn-secondary" to="/clientes"><Users size={16} /> Clientes</Link>
        </div>
      </div>

      <div className="stats-grid dashboard-stats">
        {stats.map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="card stat-card">
              <div className="stat-icon" style={{ background: stat.bg, color: stat.color }}><Icon size={20} /></div>
              <div className="stat-label">{stat.label}</div>
              <div className="stat-value">{stat.value}</div>
              <div className={`stat-change ${stat.positive ? 'positive' : 'negative'}`}>
                {stat.positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {stat.change}
              </div>
            </div>
          )
        })}
      </div>

      <div className="dashboard-grid">
        <section className="card dashboard-panel">
          <div className="panel-head">
            <div>
              <h3>Préstamos recientes</h3>
              <p>Últimos préstamos registrados en la app.</p>
            </div>
            <Link to="/prestamos">Ver todos</Link>
          </div>

          {computed.recentLoans.length === 0 ? (
            <div className="empty-panel">No hay préstamos registrados todavía.</div>
          ) : (
            <div className="loan-list-mini">
              {computed.recentLoans.map(loan => (
                <div key={loan.id} className="loan-row-mini">
                  <div>
                    <strong>{loan.client_name || 'Cliente sin nombre'}</strong>
                    <span>{statusLabel(loan.status)} · {loan.installments_count || 0} cuotas</span>
                  </div>
                  <div className="row-money">
                    <strong>{formatCOP(loan.total_amount)}</strong>
                    <span>Saldo {formatCOP(loan.balance)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card dashboard-panel">
          <div className="panel-head">
            <div>
              <h3>Atención y vencimientos</h3>
              <p>Prioridad por cuotas vencidas o fechas próximas.</p>
            </div>
            <AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} />
          </div>

          {computed.priorityLoans.length === 0 ? (
            <div className="empty-panel success-empty">Sin préstamos activos pendientes.</div>
          ) : (
            <div className="priority-list">
              {computed.priorityLoans.map(loan => (
                <div key={loan.id} className={`priority-row ${Number(loan.overdue_count || 0) > 0 ? 'overdue' : ''}`}>
                  <div className="priority-icon"><CalendarDays size={16} /></div>
                  <div>
                    <strong>{loan.client_name}</strong>
                    <span>
                      {Number(loan.overdue_count || 0) > 0
                        ? `${loan.overdue_count} cuota(s) vencida(s)`
                        : `Primera cuota: ${formatDate(loan.first_due_date)}`}
                    </span>
                  </div>
                  <div className="row-money"><strong>{formatCOP(loan.balance)}</strong><span>saldo</span></div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="dashboard-grid small-grid">
        <section className="card mini-card">
          <div className="mini-icon"><UserRound size={18} /></div>
          <div>
            <span>Clientes activos</span>
            <strong>{data.clientSummary.active || data.clients.filter(c => c.status === 'active').length}</strong>
          </div>
        </section>
        <section className="card mini-card">
          <div className="mini-icon"><Users size={18} /></div>
          <div>
            <span>Total clientes</span>
            <strong>{data.clientSummary.total || data.clients.length}</strong>
          </div>
        </section>
        <section className="card mini-card">
          <div className="mini-icon"><Wallet size={18} /></div>
          <div>
            <span>Préstamos pagados</span>
            <strong>{computed.paidLoans.length}</strong>
          </div>
        </section>
      </div>

      <style>{`
        .dashboard-top { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; }
        .dashboard-actions { display:flex; gap:10px; flex-wrap:wrap; }
        .dashboard-stats { grid-template-columns: repeat(4, 1fr) !important; }
        .dashboard-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:16px; }
        .dashboard-panel { padding:0; overflow:hidden; }
        .panel-head { padding:16px 20px; border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:center; gap:12px; }
        .panel-head h3 { margin:0; font-size:.95rem; font-weight:700; color:var(--color-text-primary); }
        .panel-head p { margin:3px 0 0; font-size:.75rem; color:var(--color-text-muted); }
        .panel-head a { font-size:.78rem; color:var(--color-accent); text-decoration:none; }
        .loan-list-mini, .priority-list { display:flex; flex-direction:column; }
        .loan-row-mini, .priority-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:13px 20px; border-bottom:1px solid var(--color-border-light); }
        .loan-row-mini:last-child, .priority-row:last-child { border-bottom:none; }
        .loan-row-mini strong, .priority-row strong { display:block; color:var(--color-text-primary); font-size:.86rem; }
        .loan-row-mini span, .priority-row span { display:block; color:var(--color-text-muted); font-size:.72rem; margin-top:2px; }
        .row-money { text-align:right; min-width:110px; }
        .priority-row { justify-content:flex-start; }
        .priority-row .row-money { margin-left:auto; }
        .priority-icon { width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; background:var(--color-accent-soft); color:var(--color-accent); flex:0 0 auto; }
        .priority-row.overdue .priority-icon { background:var(--color-danger-soft); color:var(--color-danger); }
        .empty-panel { padding:28px 20px; color:var(--color-text-muted); text-align:center; font-size:.85rem; }
        .success-empty { color:var(--color-success); }
        .small-grid { grid-template-columns:repeat(3, 1fr); }
        .mini-card { padding:16px; display:flex; align-items:center; gap:12px; }
        .mini-icon { width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; background:var(--color-accent-soft); color:var(--color-accent); }
        .mini-card span { display:block; color:var(--color-text-muted); font-size:.76rem; }
        .mini-card strong { display:block; color:var(--color-text-primary); font-size:1.2rem; margin-top:2px; }
        @media (max-width:900px){ .dashboard-stats{grid-template-columns:1fr 1fr!important}.dashboard-grid,.small-grid{grid-template-columns:1fr}.row-money{text-align:left;min-width:auto}.loan-row-mini,.priority-row{align-items:flex-start;flex-wrap:wrap} }
        @media (max-width:560px){ .dashboard-stats{grid-template-columns:1fr!important}.dashboard-actions{width:100%}.dashboard-actions .btn{flex:1;justify-content:center} }
      `}</style>
    </div>
  )
}
