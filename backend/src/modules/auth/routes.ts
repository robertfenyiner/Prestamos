import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import db from '../../database'
import { authRequired, generateToken, type AuthRequest } from '../../middleware/auth'

const router = Router()

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' })
      return
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
      return
    }

    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existing) {
      res.status(409).json({ error: 'Ya existe un usuario con ese email' })
      return
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const result = db.prepare(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)'
    ).run(name, email, hashedPassword)

    const token = generateToken({
      id: result.lastInsertRowid as number,
      email,
      role: 'user',
    })

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      token,
      user: { id: result.lastInsertRowid, name, email, role: 'user' },
    })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ error: 'Error al registrar usuario' })
  }
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Usuario y contraseña son requeridos' })
      return
    }

    const user = db.prepare(
      'SELECT id, name, email, password, role FROM users WHERE email = ?'
    ).get(email) as any

    if (!user) {
      res.status(401).json({ error: 'Credenciales inválidas' })
      return
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      res.status(401).json({ error: 'Credenciales inválidas' })
      return
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role })

    res.json({
      message: 'Login exitoso',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Error al iniciar sesión' })
  }
})

// GET /api/auth/me
router.get('/me', authRequired, (req: AuthRequest, res: Response) => {
  const user = db.prepare(
    'SELECT id, name, email, role, created_at FROM users WHERE id = ?'
  ).get(req.user!.id) as any

  if (!user) {
    res.status(404).json({ error: 'Usuario no encontrado' })
    return
  }

  res.json({ user })
})

export default router
