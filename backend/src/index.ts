import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { initDatabase } from './database'
import { errorHandler, notFound } from './middleware/errorHandler'
import { updateExchangeRates } from './services/currencyService'
import authRoutes from './modules/auth/routes'
import gastosRoutes from './modules/gastos/routes'
import ahorrosRoutes from './modules/ahorros/routes'
import dashboardRoutes from './modules/dashboard/routes'
import currenciesRoutes from './modules/currencies/routes'
import filesRoutes from './modules/files/routes'
import notificationsRoutes, { startNotificationScheduler } from './modules/notifications/routes'

const app = express()
const PORT = Number(process.env.PORT) || 3001

// Trust the first reverse proxy in production deployments such as Nginx.
// This keeps express-rate-limit accurate when X-Forwarded-For is present.
app.set('trust proxy', 1)

// ===== Middleware =====
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
    /^http:\/\/100\.\d+\.\d+\.\d+:\d+$/,
  ],
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

// Auth rate limit (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos, intenta en 15 minutos' },
})
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)

// ===== Routes =====
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    app: 'RobertApp API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/gastos', gastosRoutes)
app.use('/api/ahorros', ahorrosRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/currencies', currenciesRoutes)
app.use('/api/files', filesRoutes)
app.use('/api/notifications', notificationsRoutes)

// ===== Error Handling =====
app.use(notFound)
app.use(errorHandler)

// ===== Start =====
initDatabase()

// Update exchange rates on startup
updateExchangeRates().catch(err => console.error('Initial rate update failed:', err.message))

app.listen(PORT, '0.0.0.0', () => {
  console.log('')
  console.log('  ╔══════════════════════════════════════════╗')
  console.log('  ║         🚀 RobertApp API Server          ║')
  console.log('  ╠══════════════════════════════════════════╣')
  console.log(`  ║  Local:     http://localhost:${PORT}         ║`)
  console.log(`  ║  Network:   http://0.0.0.0:${PORT}           ║`)
  console.log(`  ║  Env:       ${process.env.NODE_ENV || 'development'}              ║`)
  console.log('  ╚══════════════════════════════════════════╝')
  console.log('')

  // Start notification scheduler
  startNotificationScheduler()
})

export default app
