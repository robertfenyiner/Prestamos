import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email credentials not configured')
  }

  return transporter.sendMail({
    from: `"RobertApp" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  })
}

function fmtCOP(n: number) {
  return '$' + n.toLocaleString('es-CO', { maximumFractionDigits: 0 })
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

const FREQ: Record<string, string> = {
  daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual', yearly: 'Anual',
}

export async function sendRecurringExpenseReminder(
  email: string,
  expenses: Array<{ description: string; amount: number; currency_symbol: string; currency_code: string; amount_cop: number | null; recurring_frequency: string; next_due_date: string; category_name?: string; category_icon?: string }>
) {
  const rows = expenses.map(e => `
    <tr>
      <td style="padding:10px 6px;border-bottom:1px solid #2a2a3e;word-break:break-word;">
        <strong>${e.description}</strong>
        ${e.category_name ? `<br><span style="font-size:11px;color:#a78bfa;">${e.category_icon || '📋'} ${e.category_name}</span>` : ''}
      </td>
      <td style="padding:10px 6px;border-bottom:1px solid #2a2a3e;text-align:right;">
        <strong>${e.currency_symbol}${e.amount.toLocaleString('es-CO')}</strong> <span style="font-size:10px;color:#888;">${e.currency_code}</span>
        ${e.amount_cop && e.currency_code !== 'COP' ? `<br><span style="font-size:10px;color:#888;">≈ ${fmtCOP(e.amount_cop)} COP</span>` : ''}
      </td>
      <td style="padding:10px 6px;border-bottom:1px solid #2a2a3e;text-align:center;font-size:11px;color:#a78bfa;">${FREQ[e.recurring_frequency] || e.recurring_frequency}</td>
      <td style="padding:10px 6px;border-bottom:1px solid #2a2a3e;text-align:center;font-size:12px;">${fmtDate(e.next_due_date)}</td>
    </tr>
  `).join('')

  const total = expenses.reduce((s, e) => s + (e.amount_cop || e.amount), 0)

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#1a1a2e;color:#e0e0e0;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#6366f1,#a78bfa);padding:24px 28px;">
      <h1 style="margin:0;font-size:22px;color:white;">💰 RobertApp — Recordatorio</h1>
      <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">Tienes ${expenses.length} gasto${expenses.length > 1 ? 's' : ''} recurrente${expenses.length > 1 ? 's' : ''} próximo${expenses.length > 1 ? 's' : ''} a vencer</p>
    </div>
    <div style="padding:16px 12px;">
      <div style="overflow-x:auto;width:100%;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:320px;">
          <thead>
            <tr style="color:#888;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">
              <th style="padding:8px 6px;text-align:left;border-bottom:2px solid #2a2a3e;">Descripción</th>
              <th style="padding:8px 6px;text-align:right;border-bottom:2px solid #2a2a3e;">Monto</th>
              <th style="padding:8px 6px;text-align:center;border-bottom:2px solid #2a2a3e;">Frecuencia</th>
              <th style="padding:8px 6px;text-align:center;border-bottom:2px solid #2a2a3e;">Vence</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="margin-top:16px;padding:14px;background:#2a2a3e;border-radius:8px;text-align:center;">
        <span style="font-size:13px;color:#888;">Total aproximado:</span>
        <span style="font-size:18px;font-weight:700;color:#6366f1;margin-left:8px;">${fmtCOP(total)}</span>
      </div>
      ${process.env.APP_URL ? `
      <div style="text-align:center;margin-top:20px;">
        <a href="${process.env.APP_URL}/gastos" style="display:inline-block;padding:10px 28px;background:#6366f1;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Ver mis gastos</a>
      </div>` : ''}
    </div>
    <div style="padding:14px 24px;text-align:center;font-size:11px;color:#555;border-top:1px solid #2a2a3e;">
      RobertApp • Gestión de Finanzas Personales
    </div>
  </div>`

  return sendEmail(email, `💰 ${expenses.length} gasto${expenses.length > 1 ? 's' : ''} próximo${expenses.length > 1 ? 's' : ''} a vencer`, html)
}

export async function sendTestEmail(email: string) {
  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:500px;margin:0 auto;background:#1a1a2e;color:#e0e0e0;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#6366f1,#a78bfa);padding:24px 28px;">
      <h1 style="margin:0;font-size:22px;color:white;">✅ Email de Prueba</h1>
    </div>
    <div style="padding:28px;text-align:center;">
      <p style="font-size:16px;margin:0 0 8px;">¡Las notificaciones de <strong>RobertApp</strong> están configuradas correctamente!</p>
      <p style="font-size:13px;color:#888;margin:0;">Recibirás recordatorios de tus gastos recurrentes por este medio.</p>
    </div>
    <div style="padding:14px 24px;text-align:center;font-size:11px;color:#555;border-top:1px solid #2a2a3e;">
      RobertApp • Gestión de Finanzas Personales
    </div>
  </div>`

  return sendEmail(email, '✅ RobertApp — Email de prueba', html)
}
