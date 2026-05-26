import { useEffect, useState } from 'react'
import {
  Send, Loader2, CheckCircle, AlertCircle, Save,
  Mail, Info, Zap, Lock, KeyRound, MessageCircle, RefreshCw,
} from 'lucide-react'
import { authAPI, notificationsAPI } from '@/lib/api'

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [testingTg, setTestingTg] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [testingWhatsApp, setTestingWhatsApp] = useState(false)
  const [sendingWhatsAppReport, setSendingWhatsAppReport] = useState(false)
  const [sendingTelegramReport, setSendingTelegramReport] = useState(false)
  const [checkingWhatsApp, setCheckingWhatsApp] = useState(false)
  const [sendingReport, setSendingReport] = useState(false)
  const [whatsAppStatus, setWhatsAppStatus] = useState<any>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [form, setForm] = useState({
    email_enabled: true,
    email_address: '',
    telegram_enabled: false,
    telegram_chat_id: '',
    notify_days_before: 1,
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
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

    refreshWhatsAppStatus(false)
  }, [])

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 6000)
  }

  const refreshWhatsAppStatus = async (notify = true) => {
    setCheckingWhatsApp(true)
    try {
      const r = await notificationsAPI.getWhatsAppStatus()
      setWhatsAppStatus(r.data)
      if (notify) {
        const sessionStatus = r.data.session?.whatsapp_status || r.data.session?.status
        showMsg('success', sessionStatus ? `Estado de WhatsApp: ${sessionStatus}` : 'Estado de WhatsApp consultado')
      }
    } catch (err: any) {
      showMsg('error', err.response?.data?.error || 'Error al consultar WhatsApp')
    }
    setCheckingWhatsApp(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const r = await notificationsAPI.updateSettings(form)
      setSettings(r.data)
      showMsg('success', 'Configuración guardada correctamente')
    } catch (err: any) {
      showMsg('error', err.response?.data?.error || 'Error al guardar')
    }
    setSaving(false)
  }

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      showMsg('error', 'Completa todos los campos de contraseña')
      return
    }
    if (passwordForm.newPassword.length < 8) {
      showMsg('error', 'La nueva contraseña debe tener al menos 8 caracteres')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMsg('error', 'La nueva contraseña y la confirmación no coinciden')
      return
    }

    setChangingPassword(true)
    try {
      const r = await authAPI.changePassword(passwordForm)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      showMsg('success', r.data.message || 'Contraseña actualizada correctamente')
    } catch (err: any) {
      showMsg('error', err.response?.data?.error || 'Error al cambiar la contraseña')
    }
    setChangingPassword(false)
  }

  // Auto-save before any test action
  const saveFirst = async () => {
    try {
      const r = await notificationsAPI.updateSettings(form)
      setSettings(r.data)
    } catch { /* ignore save errors here, test will show its own */ }
  }

  const handleTestEmail = async () => {
    setTestingEmail(true)
    await saveFirst()
    try {
      const r = await notificationsAPI.sendTest()
      showMsg('success', r.data.message)
    } catch (err: any) {
      showMsg('error', err.response?.data?.error || 'Error al enviar email')
    }
    setTestingEmail(false)
  }

  const handleTestTelegram = async () => {
    setTestingTg(true)
    await saveFirst()
    try {
      const r = await notificationsAPI.testTelegram()
      showMsg('success', r.data.message)
    } catch (err: any) {
      showMsg('error', err.response?.data?.error || 'Error al enviar mensaje de Telegram')
    }
    setTestingTg(false)
  }

  const handleSendTelegramFinanceReport = async () => {
    setSendingTelegramReport(true)
    await saveFirst()
    try {
      const r = await notificationsAPI.sendTelegramReport()
      showMsg('success', r.data.message || 'Reporte financiero enviado por Telegram')
    } catch (err: any) {
      showMsg('error', err.response?.data?.error || 'Error al enviar reporte por Telegram')
    }
    setSendingTelegramReport(false)
  }

  const handleTestWhatsApp = async () => {
    setTestingWhatsApp(true)
    try {
      const r = await notificationsAPI.testWhatsApp()
      await refreshWhatsAppStatus(false)
      showMsg('success', r.data.message || 'Mensaje de prueba enviado por WhatsApp')
    } catch (err: any) {
      showMsg('error', err.response?.data?.error || 'Error al enviar WhatsApp')
    }
    setTestingWhatsApp(false)
  }

  const handleSendWhatsAppReport = async () => {
    setSendingWhatsAppReport(true)
    try {
      const r = await notificationsAPI.sendWhatsAppReport()
      showMsg('success', r.data.message || 'Reporte financiero enviado por WhatsApp')
    } catch (err: any) {
      showMsg('error', err.response?.data?.error || 'Error al enviar reporte por WhatsApp')
    }
    setSendingWhatsAppReport(false)
  }

  const handleSendReport = async () => {
    setSendingReport(true)
    await saveFirst()
    try {
      const r = await notificationsAPI.sendSavingsReport()
      showMsg('success', r.data.message)
    } catch (err: any) {
      showMsg('error', err.response?.data?.error || 'Error al enviar reporte')
    }
    setSendingReport(false)
  }

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <div style={{ position: 'relative', width: 44, height: 24, flexShrink: 0 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ opacity: 0, width: '100%', height: '100%', position: 'absolute', cursor: 'pointer', zIndex: 1, margin: 0 }} />
      <div style={{
        width: 44, height: 24, borderRadius: 12,
        background: checked ? 'var(--color-accent)' : 'var(--color-border)',
        transition: 'background 0.2s', position: 'relative',
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%', background: 'white',
          position: 'absolute', top: 3,
          left: checked ? 23 : 3,
          transition: 'left 0.2s',
        }} />
      </div>
    </div>
  )

  const whatsAppConfigured = !!whatsAppStatus?.configured
  const whatsAppSessionStatus = whatsAppStatus?.session?.whatsapp_status || whatsAppStatus?.session?.status || 'No consultado'
  const whatsAppTo = whatsAppStatus?.config?.to || 'No configurado'

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <Loader2 size={28} className="loading-spin" style={{ color: 'var(--color-accent)' }} />
    </div>
  )

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Configuración</h1>
        <p className="page-subtitle">Gestiona tus preferencias de seguridad y notificaciones</p>
      </div>

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

      <div className="settings-grid">
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}>
              <Lock size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Seguridad</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Cambia tu contraseña de acceso</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Contraseña actual</label>
              <input className="input" type="password" value={passwordForm.currentPassword}
                onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                autoComplete="current-password" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Nueva contraseña</label>
              <input className="input" type="password" value={passwordForm.newPassword}
                onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                autoComplete="new-password" />
              <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '6px 0 0' }}>Mínimo 8 caracteres.</p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Confirmar nueva contraseña</label>
              <input className="input" type="password" value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                autoComplete="new-password" />
            </div>
            <button className="btn btn-primary" onClick={handleChangePassword} disabled={changingPassword}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 20px' }}>
              {changingPassword ? <Loader2 size={16} className="loading-spin" /> : <KeyRound size={16} />}
              {changingPassword ? 'Actualizando...' : 'Cambiar Contraseña'}
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #22c55e22, #22c55e11)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
              <MessageCircle size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>WhatsApp</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Estado, pruebas y reportes vía Whatsper</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', fontSize: '0.78rem', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Configuración:</span>
                <strong style={{ color: whatsAppConfigured ? 'var(--color-success)' : 'var(--color-danger)' }}>{whatsAppConfigured ? 'Completa' : 'Incompleta'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Sesión:</span>
                <strong>{whatsAppSessionStatus}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Destino:</span>
                <strong>{whatsAppTo}</strong>
              </div>
            </div>

            <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
              El token, sesión y número destino se configuran en el archivo <code>.env</code> del servidor. No se muestran secretos en este panel.
            </p>

            <button className="btn" onClick={() => refreshWhatsAppStatus(true)} disabled={checkingWhatsApp}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 20px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
              {checkingWhatsApp ? <Loader2 size={16} className="loading-spin" /> : <RefreshCw size={16} />}
              {checkingWhatsApp ? 'Consultando...' : 'Verificar Estado'}
            </button>

            <button className="btn btn-primary" onClick={handleTestWhatsApp} disabled={testingWhatsApp || !whatsAppConfigured}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 20px' }}>
              {testingWhatsApp ? <Loader2 size={16} className="loading-spin" /> : <MessageCircle size={16} />}
              {testingWhatsApp ? 'Enviando...' : 'Enviar WhatsApp de Prueba'}
            </button>

            <button className="btn" onClick={handleSendWhatsAppReport} disabled={sendingWhatsAppReport || !whatsAppConfigured}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 20px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
              {sendingWhatsAppReport ? <Loader2 size={16} className="loading-spin" /> : <Zap size={16} />}
              {sendingWhatsAppReport ? 'Enviando...' : 'Enviar Reporte Financiero'}
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #0088cc22, #0088cc11)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0088cc' }}>
              <Send size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Telegram</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Resumen diario y reportes financieros</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Activar notificaciones por Telegram</span>
              <Toggle checked={form.telegram_enabled} onChange={v => setForm({ ...form, telegram_enabled: v })} />
            </label>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                Chat ID de Telegram
              </label>
              <input className="input" type="text" value={form.telegram_chat_id}
                onChange={e => setForm({ ...form, telegram_chat_id: e.target.value })}
                placeholder="Ej: 7559796631"
                disabled={!form.telegram_enabled} />
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Info size={14} style={{ color: 'var(--color-accent)' }} />
                <strong style={{ color: 'var(--color-text-primary)' }}>Telegram configurado como canal redundante</strong>
              </div>
              <p style={{ margin: 0 }}>Guarda tu Chat ID y usa los botones de prueba/reporte para confirmar recepción.</p>
            </div>

            <button className="btn btn-primary" onClick={handleTestTelegram}
              disabled={testingTg || !form.telegram_chat_id || !form.telegram_enabled}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 20px' }}>
              {testingTg ? <Loader2 size={16} className="loading-spin" /> : <Send size={16} />}
              {testingTg ? 'Enviando...' : 'Enviar Mensaje de Prueba'}
            </button>

            <button className="btn" onClick={handleSendTelegramFinanceReport}
              disabled={sendingTelegramReport || !form.telegram_chat_id || !form.telegram_enabled}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 20px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
              {sendingTelegramReport ? <Loader2 size={16} className="loading-spin" /> : <Zap size={16} />}
              {sendingTelegramReport ? 'Enviando...' : 'Enviar Reporte Financiero'}
            </button>

            <button className="btn" onClick={handleSendReport}
              disabled={sendingReport || !form.telegram_chat_id || !form.telegram_enabled}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 20px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
              {sendingReport ? <Loader2 size={16} className="loading-spin" /> : <Zap size={16} />}
              {sendingReport ? 'Enviando...' : 'Enviar Reporte Diario Ahora'}
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}>
              <Mail size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Email</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Recordatorios de gastos recurrentes</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Activar notificaciones por email</span>
              <Toggle checked={form.email_enabled} onChange={v => setForm({ ...form, email_enabled: v })} />
            </label>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Dirección de email</label>
              <input className="input" type="email" value={form.email_address}
                onChange={e => setForm({ ...form, email_address: e.target.value })}
                placeholder="tu@email.com"
                disabled={!form.email_enabled} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                Días de anticipación: <strong style={{ color: 'var(--color-accent)', fontSize: '1rem' }}>{form.notify_days_before}</strong>
              </label>
              <input type="range" min={1} max={7} value={form.notify_days_before}
                onChange={e => setForm({ ...form, notify_days_before: Number(e.target.value) })}
                disabled={!form.email_enabled}
                style={{ width: '100%', accentColor: 'var(--color-accent)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                <span>1 día</span><span>7 días</span>
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleTestEmail}
              disabled={testingEmail || !form.email_address || !form.email_enabled}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 20px' }}>
              {testingEmail ? <Loader2 size={16} className="loading-spin" /> : <Send size={16} />}
              {testingEmail ? 'Enviando...' : 'Enviar Email de Prueba'}
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 16, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.6 }}>
            📱 <strong>Telegram:</strong> Canal redundante para reportes financieros y resumen de cajitas.<br />
            💬 <strong>WhatsApp:</strong> Disponible para pruebas y reportes financieros vía Whatsper.<br />
            📧 <strong>Email:</strong> Recibirás recordatorios de gastos recurrentes próximos a vencer.<br />
            🔐 <strong>Seguridad:</strong> Usa una contraseña única y privada para esta aplicación.
          </p>
        </div>
      </div>

      <div style={{ position: 'sticky', bottom: 16, marginTop: 20, display: 'flex', justifyContent: 'center' }}>
        <button className="btn btn-success" onClick={handleSave} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 32px', fontSize: '0.92rem', boxShadow: 'var(--shadow-lg)' }}>
          {saving ? <Loader2 size={18} className="loading-spin" /> : <Save size={18} />}
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>

      <style>{`
        .loading-spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 768px) {
          .settings-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
