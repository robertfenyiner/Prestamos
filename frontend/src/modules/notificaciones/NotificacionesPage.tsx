import { useEffect, useState } from 'react'
import {
  Bell, Mail, Loader2, Send, Save, CheckCircle, AlertCircle,
} from 'lucide-react'
import { notificationsAPI } from '@/lib/api'

export default function NotificacionesPage() {
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [form, setForm] = useState({
    email_enabled: true,
    email_address: '',
    telegram_enabled: false,
    telegram_chat_id: '',
    notify_days_before: 1,
  })

  useEffect(() => {
    notificationsAPI.getSettings()
      .then(r => {
        setSettings(r.data)
        setForm({
          email_enabled: !!r.data.email_enabled,
          email_address: r.data.email_address || '',
          telegram_enabled: !!r.data.telegram_enabled,
          telegram_chat_id: r.data.telegram_chat_id || '',
          notify_days_before: r.data.notify_days_before || 1,
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const r = await notificationsAPI.updateSettings(form)
      setSettings(r.data)
      showMessage('success', 'Configuración guardada correctamente')
    } catch (err: any) {
      showMessage('error', err.response?.data?.error || 'Error al guardar')
    }
    setSaving(false)
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const r = await notificationsAPI.sendTest()
      showMessage('success', r.data.message)
    } catch (err: any) {
      showMessage('error', err.response?.data?.error || 'Error al enviar email de prueba')
    }
    setTesting(false)
  }

  const [testingTg, setTestingTg] = useState(false)
  const handleTestTelegram = async () => {
    setTestingTg(true)
    try {
      const r = await notificationsAPI.testTelegram()
      showMessage('success', r.data.message)
    } catch (err: any) {
      showMessage('error', err.response?.data?.error || 'Error al enviar mensaje de Telegram (¿Falta el Token del Bot?)')
    }
    setTestingTg(false)
  }

  const handleCheckDue = async () => {
    try {
      const r = await notificationsAPI.checkDue()
      showMessage('success', r.data.message)
    } catch (err: any) {
      showMessage('error', err.response?.data?.error || 'Error al verificar gastos')
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <Loader2 size={28} className="loading-spin" style={{ color: 'var(--color-accent)' }} />
    </div>
  )

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Notificaciones</h1>
        <p className="page-subtitle">Configura los recordatorios de tus gastos recurrentes</p>
      </div>

      {/* Message */}
      {message && (
        <div className="card animate-fade-in" style={{
          padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
          background: message.type === 'success' ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
          border: `1px solid ${message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}`,
          borderRadius: 'var(--radius-md)',
        }}>
          {message.type === 'success' ? <CheckCircle size={18} style={{ color: 'var(--color-success)' }} /> : <AlertCircle size={18} style={{ color: 'var(--color-danger)' }} />}
          <span style={{ fontSize: '0.85rem', color: message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)' }}>{message.text}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Email Settings */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}>
              <Mail size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Notificaciones por Email</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Recibe recordatorios en tu correo</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Enable toggle */}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Activar notificaciones por email</span>
              <div style={{ position: 'relative', width: 44, height: 24 }}>
                <input type="checkbox" checked={form.email_enabled}
                  onChange={e => setForm({ ...form, email_enabled: e.target.checked })}
                  style={{ opacity: 0, width: '100%', height: '100%', position: 'absolute', cursor: 'pointer', zIndex: 1, margin: 0 }} />
                <div style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: form.email_enabled ? 'var(--color-accent)' : 'var(--color-border)',
                  transition: 'background 0.2s', position: 'relative',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', background: 'white',
                    position: 'absolute', top: 3,
                    left: form.email_enabled ? 23 : 3,
                    transition: 'left 0.2s',
                  }} />
                </div>
              </div>
            </label>

            {/* Email address */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Dirección de email</label>
              <input className="input" type="email" value={form.email_address}
                onChange={e => setForm({ ...form, email_address: e.target.value })}
                placeholder="tu@email.com"
                disabled={!form.email_enabled} />
            </div>

            {/* Days before */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                Días de anticipación: <strong style={{ color: 'var(--color-accent)', fontSize: '1rem' }}>{form.notify_days_before}</strong>
              </label>
              <input type="range" min={1} max={7} value={form.notify_days_before}
                onChange={e => setForm({ ...form, notify_days_before: Number(e.target.value) })}
                disabled={!form.email_enabled}
                style={{ width: '100%', accentColor: 'var(--color-accent)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                <span>1 día</span>
                <span>7 días</span>
              </div>
            </div>

            {/* Save button */}
            <button className="btn btn-success" onClick={handleSave} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 20px' }}>
              {saving ? <Loader2 size={16} className="loading-spin" /> : <Save size={16} />}
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>
        {/* Telegram Settings */}
        <div className="card" style={{ padding: 24, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
              <Send size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Notificaciones por Telegram</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Recibe el resumen diario de ahorros</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Enable toggle */}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Activar notificaciones por Telegram</span>
              <div style={{ position: 'relative', width: 44, height: 24 }}>
                <input type="checkbox" checked={form.telegram_enabled}
                  onChange={e => setForm({ ...form, telegram_enabled: e.target.checked })}
                  style={{ opacity: 0, width: '100%', height: '100%', position: 'absolute', cursor: 'pointer', zIndex: 1, margin: 0 }} />
                <div style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: form.telegram_enabled ? '#3b82f6' : 'var(--color-border)',
                  transition: 'background 0.2s', position: 'relative',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', background: 'white',
                    position: 'absolute', top: 3,
                    left: form.telegram_enabled ? 23 : 3,
                    transition: 'left 0.2s',
                  }} />
                </div>
              </div>
            </label>

            {/* Chat ID */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Chat ID de Telegram</label>
              <input className="input" type="text" value={form.telegram_chat_id}
                onChange={e => setForm({ ...form, telegram_chat_id: e.target.value })}
                placeholder="Ej: 7559796631"
                disabled={!form.telegram_enabled} />
              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 6, margin: 0 }}>
                Obtenlo enviando un mensaje a <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>@userinfobot</a>.
              </p>
            </div>

            {/* Save button */}
            <button className="btn btn-success" onClick={handleSave} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 20px', marginTop: 8 }}>
              {saving ? <Loader2 size={16} className="loading-spin" /> : <Save size={16} />}
              {saving ? 'Guardando...' : 'Guardar Telegram'}
            </button>
          </div>
        </div>
      </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Test Email */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-warning-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-warning)' }}>
                <Send size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Email de Prueba</h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Verifica que las notificaciones funcionen</p>
              </div>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: 14 }}>
              Envía un email de prueba a <strong>{form.email_address || 'tu dirección configurada'}</strong> para verificar que todo esté funcionando correctamente.
            </p>
            <button className="btn btn-primary" onClick={handleTest} disabled={testing || !form.email_address}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '10px 20px' }}>
              {testing ? <Loader2 size={16} className="loading-spin" /> : <Send size={16} />}
              {testing ? 'Enviando...' : 'Enviar Email de Prueba'}
            </button>
          </div>

          {/* Test Telegram */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                <Send size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Test de Telegram</h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Verifica la conexión con el bot</p>
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleTestTelegram} disabled={testingTg || !form.telegram_chat_id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '10px 20px', background: '#3b82f6', borderColor: '#3b82f6' }}>
              {testingTg ? <Loader2 size={16} className="loading-spin" /> : <Send size={16} />}
              {testingTg ? 'Enviando...' : 'Enviar Test a Telegram'}
            </button>
          </div>

          {/* Check Due */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success)' }}>
                <Bell size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Verificar Gastos Pendientes</h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Ejecuta la verificación manualmente</p>
              </div>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: 14 }}>
              Revisa si hay gastos recurrentes próximos a vencer y envía las notificaciones correspondientes. Esto se ejecuta automáticamente cada 12 horas.
            </p>
            <button className="btn btn-ghost" onClick={handleCheckDue}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '10px 20px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
              <Bell size={16} /> Verificar Ahora
            </button>
          </div>

          {/* Info */}
          <div className="card" style={{ padding: 16, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
              ℹ️ El sistema verifica automáticamente cada 12 horas si tienes gastos recurrentes próximos a vencer. Recibirás un email con el detalle de los gastos y sus montos.
            </p>
          </div>
        </div>
      </div>

      {/* Scoped Styles */}
      <style>{`
        .loading-spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .btn-ghost { background: var(--color-bg-elevated); border: 1px solid var(--color-border); }

        @media (max-width: 768px) {
          .card { margin-bottom: 0; }
        }
      `}</style>
    </div>
  )
}
