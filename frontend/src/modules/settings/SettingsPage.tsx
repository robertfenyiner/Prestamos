import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle, CreditCard, KeyRound, Loader2, Mail, MessageCircle, Save, Send, Zap } from 'lucide-react'
import { authAPI, notificationsAPI } from '@/lib/api'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [whatsAppStatus, setWhatsAppStatus] = useState<any>(null)

  const [testingEmail, setTestingEmail] = useState(false)
  const [testingTelegram, setTestingTelegram] = useState(false)
  const [sendingTelegramReport, setSendingTelegramReport] = useState(false)
  const [sendingSavingsReport, setSendingSavingsReport] = useState(false)
  const [checkingWhatsApp, setCheckingWhatsApp] = useState(false)
  const [testingWhatsApp, setTestingWhatsApp] = useState(false)
  const [sendingWhatsAppReport, setSendingWhatsAppReport] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  const [form, setForm] = useState({
    email_enabled: true,
    email_address: '',
    telegram_enabled: false,
    telegram_chat_id: '',
    whatsapp_enabled: true,
    notify_days_before: 1,
    credit_card_notify_days_before: 3,
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  useEffect(() => {
    notificationsAPI.getSettings()
      .then(r => {
        setForm({
          email_enabled: !!r.data.email_enabled,
          email_address: r.data.email_address || '',
          telegram_enabled: !!r.data.telegram_enabled,
          telegram_chat_id: r.data.telegram_chat_id || '',
          whatsapp_enabled: r.data.whatsapp_enabled !== 0,
          notify_days_before: r.data.notify_days_before || 1,
          credit_card_notify_days_before: r.data.credit_card_notify_days_before || 3,
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

  const saveSettings = async () => {
    setSaving(true)
    try {
      const r = await notificationsAPI.updateSettings(form)
      setForm({
        email_enabled: !!r.data.email_enabled,
        email_address: r.data.email_address || '',
        telegram_enabled: !!r.data.telegram_enabled,
        telegram_chat_id: r.data.telegram_chat_id || '',
        whatsapp_enabled: r.data.whatsapp_enabled !== 0,
        notify_days_before: r.data.notify_days_before || 1,
        credit_card_notify_days_before: r.data.credit_card_notify_days_before || 3,
      })
      showMsg('success', 'Configuración guardada correctamente')
      await refreshWhatsAppStatus(false)
    } catch (err: any) {
      showMsg('error', err.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const saveFirst = async () => {
    await notificationsAPI.updateSettings(form)
  }

  const refreshWhatsAppStatus = async (notify = true) => {
    setCheckingWhatsApp(true)
    try {
      const r = await notificationsAPI.getWhatsAppStatus()
      setWhatsAppStatus(r.data)
      if (notify) {
        if (r.data.enabled === false) showMsg('success', 'WhatsApp está apagado. No se consume cupo de Whatsper.')
        else showMsg('success', `Estado de WhatsApp: ${r.data.session?.whatsapp_status || 'consultado'}`)
      }
    } catch (err: any) {
      showMsg('error', err.response?.data?.error || 'Error al consultar WhatsApp')
    } finally {
      setCheckingWhatsApp(false)
    }
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
    } finally {
      setChangingPassword(false)
    }
  }

  const handleTestEmail = async () => {
    setTestingEmail(true)
    try {
      await saveFirst()
      const r = await notificationsAPI.sendTest()
      showMsg('success', r.data.message)
    } catch (err: any) {
      showMsg('error', err.response?.data?.error || 'Error al enviar email')
    } finally {
      setTestingEmail(false)
    }
  }

  const handleTestTelegram = async () => {
    setTestingTelegram(true)
    try {
      await saveFirst()
      const r = await notificationsAPI.testTelegram()
      showMsg('success', r.data.message)
    } catch (err: any) {
      showMsg('error', err.response?.data?.error || 'Error al enviar Telegram')
    } finally {
      setTestingTelegram(false)
    }
  }

  const handleSendTelegramReport = async () => {
    setSendingTelegramReport(true)
    try {
      await saveFirst()
      const r = await notificationsAPI.sendTelegramReport()
      showMsg('success', r.data.message)
    } catch (err: any) {
      showMsg('error', err.response?.data?.error || 'Error al enviar reporte por Telegram')
    } finally {
      setSendingTelegramReport(false)
    }
  }

  const handleSendSavingsReport = async () => {
    setSendingSavingsReport(true)
    try {
      await saveFirst()
      const r = await notificationsAPI.sendSavingsReport()
      showMsg('success', r.data.message)
    } catch (err: any) {
      showMsg('error', err.response?.data?.error || 'Error al enviar reporte diario')
    } finally {
      setSendingSavingsReport(false)
    }
  }

  const handleTestWhatsApp = async () => {
    setTestingWhatsApp(true)
    try {
      await saveFirst()
      const r = await notificationsAPI.testWhatsApp()
      showMsg('success', r.data.message)
    } catch (err: any) {
      showMsg('error', err.response?.data?.error || 'Error al enviar WhatsApp')
    } finally {
      setTestingWhatsApp(false)
    }
  }

  const handleSendWhatsAppReport = async () => {
    setSendingWhatsAppReport(true)
    try {
      await saveFirst()
      const r = await notificationsAPI.sendWhatsAppReport()
      showMsg('success', r.data.message)
    } catch (err: any) {
      showMsg('error', err.response?.data?.error || 'Error al enviar reporte por WhatsApp')
    } finally {
      setSendingWhatsAppReport(false)
    }
  }

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>{checked ? 'Activo' : 'Apagado'}</span>
    </label>
  )

  const Card = ({ title, subtitle, icon, children }: any) => (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18 }}>
        <div style={{ color: 'var(--color-accent)' }}>{icon}</div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{subtitle}</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  )

  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}><Loader2 className="loading-spin" /></div>

  const whatsAppConfigured = !!whatsAppStatus?.configured
  const whatsAppEnabled = form.whatsapp_enabled
  const whatsAppSession = whatsAppStatus?.session?.whatsapp_status || (whatsAppEnabled ? 'No consultado' : 'Apagado')
  const whatsAppTo = whatsAppStatus?.config?.to || 'No configurado'

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Configuración</h1>
        <p className="page-subtitle">Gestiona seguridad, correo y canales de notificación</p>
      </div>

      {message && (
        <div className="card" style={{ padding: 12, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          {message.type === 'success' ? <CheckCircle size={18} style={{ color: 'var(--color-success)' }} /> : <AlertCircle size={18} style={{ color: 'var(--color-danger)' }} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="settings-grid">
        <Card title="Seguridad" subtitle="Cambia tu contraseña de acceso" icon={<KeyRound size={22} />}>
          <input className="input" type="password" placeholder="Contraseña actual" value={passwordForm.currentPassword} onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
          <input className="input" type="password" placeholder="Nueva contraseña" value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
          <input className="input" type="password" placeholder="Confirmar nueva contraseña" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} />
          <button className="btn btn-primary" onClick={handleChangePassword} disabled={changingPassword}>{changingPassword ? 'Actualizando...' : 'Cambiar Contraseña'}</button>
        </Card>

        <Card title="WhatsApp" subtitle="Controla el consumo de mensajes de Whatsper" icon={<MessageCircle size={22} />}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Activar WhatsApp</strong>
            <Toggle checked={form.whatsapp_enabled} onChange={v => setForm({ ...form, whatsapp_enabled: v })} />
          </div>
          <div style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '0.82rem' }}>
            <div>Configuración: <strong>{whatsAppConfigured ? 'Completa' : 'Incompleta'}</strong></div>
            <div>Sesión: <strong>{whatsAppSession}</strong></div>
            <div>Destino: <strong>{whatsAppTo}</strong></div>
          </div>
          <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>Cuando WhatsApp está apagado, Prestamos no consulta ni envía mensajes por Whatsper.</p>
          <button className="btn" onClick={() => refreshWhatsAppStatus(true)} disabled={checkingWhatsApp || !whatsAppEnabled}>{checkingWhatsApp ? 'Consultando...' : 'Verificar Estado'}</button>
          <button className="btn btn-primary" onClick={handleTestWhatsApp} disabled={testingWhatsApp || !whatsAppConfigured || !whatsAppEnabled}>{testingWhatsApp ? 'Enviando...' : 'Enviar WhatsApp de Prueba'}</button>
          <button className="btn" onClick={handleSendWhatsAppReport} disabled={sendingWhatsAppReport || !whatsAppConfigured || !whatsAppEnabled}>{sendingWhatsAppReport ? 'Enviando...' : 'Enviar Reporte Financiero'}</button>
        </Card>

        <Card title="Telegram" subtitle="Canal redundante sin consumo de Whatsper" icon={<Send size={22} />}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Activar Telegram</strong>
            <Toggle checked={form.telegram_enabled} onChange={v => setForm({ ...form, telegram_enabled: v })} />
          </div>
          <input className="input" type="text" placeholder="Chat ID" value={form.telegram_chat_id} onChange={e => setForm({ ...form, telegram_chat_id: e.target.value })} disabled={!form.telegram_enabled} />
          <button className="btn btn-primary" onClick={handleTestTelegram} disabled={testingTelegram || !form.telegram_enabled || !form.telegram_chat_id}>{testingTelegram ? 'Enviando...' : 'Enviar Mensaje de Prueba'}</button>
          <button className="btn" onClick={handleSendTelegramReport} disabled={sendingTelegramReport || !form.telegram_enabled || !form.telegram_chat_id}>{sendingTelegramReport ? 'Enviando...' : 'Enviar Reporte Financiero'}</button>
          <button className="btn" onClick={handleSendSavingsReport} disabled={sendingSavingsReport || !form.telegram_enabled || !form.telegram_chat_id}>{sendingSavingsReport ? 'Enviando...' : 'Enviar Reporte Diario Ahora'}</button>
        </Card>

        <Card title="Email" subtitle="Recordatorios de gastos recurrentes" icon={<Mail size={22} />}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Activar email</strong>
            <Toggle checked={form.email_enabled} onChange={v => setForm({ ...form, email_enabled: v })} />
          </div>
          <input className="input" type="email" placeholder="Correo destino" value={form.email_address} onChange={e => setForm({ ...form, email_address: e.target.value })} disabled={!form.email_enabled} />
          <label style={{ fontSize: '0.82rem' }}>Días de anticipación: {form.notify_days_before}</label>
          <input type="range" min={1} max={7} value={form.notify_days_before} onChange={e => setForm({ ...form, notify_days_before: Number(e.target.value) })} disabled={!form.email_enabled} />
          <button className="btn btn-primary" onClick={handleTestEmail} disabled={testingEmail || !form.email_enabled || !form.email_address}>{testingEmail ? 'Enviando...' : 'Enviar Email de Prueba'}</button>
        </Card>

        <Card title="Tarjetas de crédito" subtitle="Alertas automáticas de corte, pago y cuotas" icon={<CreditCard size={22} />}>
          <label style={{ fontSize: '0.82rem' }}>
            Días antes para alertas de tarjetas: <strong>{form.credit_card_notify_days_before}</strong>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={form.credit_card_notify_days_before}
            onChange={e => setForm({ ...form, credit_card_notify_days_before: Number(e.target.value) })}
          />
          <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
            Este valor se usará para avisarte antes de cuotas próximas, cortes y fechas límite de pago.
          </p>
        </Card>
      </div>

      <div style={{ position: 'sticky', bottom: 16, marginTop: 20, display: 'flex', justifyContent: 'center' }}>
        <button className="btn btn-success" onClick={saveSettings} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 32px', boxShadow: 'var(--shadow-lg)' }}>
          {saving ? <Loader2 size={18} className="loading-spin" /> : <Save size={18} />}
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>

      <style>{`
        .loading-spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 768px) { .settings-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  )
}
