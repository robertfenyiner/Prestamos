import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET

  if (secret && secret.trim().length > 0) {
    return secret
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required when NODE_ENV=production')
  }

  return 'prestamos-dev-secret'
}

export const JWT_SECRET = resolveJwtSecret()

export interface AuthRequest extends Request {
  user?: {
    id: number
    email: string
    role: string
  }
}

export function authRequired(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' })
    return
  }

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number
      email: string
      role: string
    }
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
    return
  }
}

export function adminRequired(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Acceso de administrador requerido' })
    return
  }
  next()
}

export function generateToken(payload: { id: number; email: string; role: string }): string {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions)
}
