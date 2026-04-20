import { useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank, Receipt,
  ArrowUpRight, ArrowDownRight, CreditCard, Target, Loader2,
} from 'lucide-react'
import { dashboardAPI } from '@/lib/api'

interface DashboardData {
  balance: number
  totalSavings: number
  expensesThisMonth: number
  expenseCount: number
  expenseChange: number
  savingsGoalProgress: number
  recentExpenses: any[]
  savingsBoxes: any[]
  monthlyTrend: any[]
  expensesByCompany: any[]
}

function formatCOP(value: number) {
  return '$' + Math.abs(value).toLocaleString('es-CO')
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardAPI.summary()
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-accent)' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!data) return <div style={{ padding: 40, color: 'var(--color-text-muted)' }}>Error cargando datos</div>

  const stats = [
    {
      label: 'Balance General',
      value: formatCOP(data.balance),
      change: `${data.expenseChange > 0 ? '+' : ''}${data.expenseChange}%`,
      positive: data.expenseChange <= 0,
      icon: Wallet, color: 'var(--color-accent)', bg: 'var(--color-accent-soft)',
    },
    {
      label: 'Ahorros Totales',
      value: formatCOP(data.totalSavings),
      change: `${data.savingsBoxes.length} cajitas`,
      positive: true,
      icon: PiggyBank, color: 'var(--color-success)', bg: 'var(--color-success-soft)',
    },
    {
      label: 'Gastos del Mes',
      value: formatCOP(data.expensesThisMonth),
      change: `${data.expenseCount} transacciones`,
      positive: false,
      icon: Receipt, color: 'var(--color-danger)', bg: 'var(--color-danger-soft)',
    },
  ]

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Resumen financiero general — {new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="stats-grid stagger-children">
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

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Recent Expenses */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Movimientos Recientes</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Últimos gastos registrados</p>
            </div>
            <CreditCard size={18} style={{ color: 'var(--color-text-muted)' }} />
          </div>
          <div>
            {data.recentExpenses.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                No hay gastos registrados
              </div>
            ) : data.recentExpenses.map((tx: any) => (
              <div key={tx.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 20px', borderBottom: '1px solid var(--color-border-light)',
                transition: 'background var(--transition-fast)', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--color-danger-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowDownRight size={16} style={{ color: 'var(--color-danger)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>{tx.description}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{tx.category || 'Sin categoría'}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-danger)' }}>
                    -{tx.currency_symbol || '$'}{Math.abs(tx.amount).toLocaleString('es-CO', { minimumFractionDigits: tx.amount < 1000 ? 2 : 0 })} <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>{tx.currency_code}</span>
                  </div>
                  {tx.currency_code !== 'COP' && tx.amount_cop && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>≈ {formatCOP(tx.amount_cop)} COP</div>
                  )}
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {new Date(tx.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expenses by Company */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Gastos por Empresa</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Distribución en el mes actual</p>
            </div>
            <Receipt size={18} style={{ color: 'var(--color-text-muted)' }} />
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {data.expensesByCompany?.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: 10 }}>
                No hay gastos este mes
              </div>
            ) : data.expensesByCompany?.map((comp: any) => {
              const progress = data.expensesThisMonth > 0 ? Math.round((comp.total / data.expensesThisMonth) * 100) : 0
              return (
                <div key={comp.name || 'Personal'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{comp.name || 'Personal (Sin empresa)'}</span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                      {formatCOP(comp.total)}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: 'var(--color-bg-hover)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(progress, 100)}%`, height: '100%', borderRadius: 9999,
                      background: comp.color || 'var(--color-accent)',
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {progress}% del total
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .page-content > div > div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
