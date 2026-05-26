import { Router, Request, Response } from 'express'
import fs from 'fs'
import jwt from 'jsonwebtoken'
import db from '../../database'
import { authRequired, type AuthRequest, JWT_SECRET } from '../../middleware/auth'
import { expenseUpload } from '../../middleware/upload'

const router = Router()

// All routes except /download require auth middleware
router.post('/expense/:expenseId', authRequired, expenseUpload.array('attachments', 5), (req: AuthRequest, res: Response) => {
  const expenseId = Number(req.params.expenseId)
  const userId = req.user!.id
  const files = req.files as Express.Multer.File[]

  const expense = db.prepare('SELECT user_id FROM expenses WHERE id = ?').get(expenseId) as any
  if (!expense || expense.user_id !== userId) {
    res.status(404).json({ error: 'Gasto no encontrado' })
    return
  }

  if (!files || files.length === 0) {
    res.status(400).json({ error: 'No se enviaron archivos' })
    return
  }

  const insertStmt = db.prepare(`
    INSERT INTO file_attachments (user_id, expense_id, file_type, original_name, file_name, file_path, file_size, mime_type)
    VALUES (?, ?, 'expense', ?, ?, ?, ?, ?)
  `)

  const uploaded: any[] = []
  for (const f of files) {
    const result = insertStmt.run(userId, expenseId, f.originalname, f.filename, f.path, f.size, f.mimetype)
    uploaded.push({
      id: result.lastInsertRowid,
      originalName: f.originalname,
      size: f.size,
      mimeType: f.mimetype,
      isImage: f.mimetype.startsWith('image/'),
    })
  }

  res.json({ message: `${uploaded.length} archivo(s) subido(s)`, files: uploaded })
})

// GET /api/files/expense/:expenseId — list files
router.get('/expense/:expenseId', authRequired, (req: AuthRequest, res: Response) => {
  const expenseId = Number(req.params.expenseId)
  const userId = req.user!.id

  const expense = db.prepare('SELECT user_id FROM expenses WHERE id = ?').get(expenseId) as any
  if (!expense || expense.user_id !== userId) {
    res.status(404).json({ error: 'Gasto no encontrado' })
    return
  }

  const files = db.prepare(`
    SELECT id, original_name, file_name, file_size, mime_type, created_at
    FROM file_attachments
    WHERE expense_id = ? AND file_type = 'expense'
    ORDER BY created_at DESC
  `).all(expenseId)

  const result = (files as any[]).map(f => ({
    id: f.id,
    originalName: f.original_name,
    size: f.file_size,
    mimeType: f.mime_type,
    isImage: f.mime_type.startsWith('image/'),
    createdAt: f.created_at,
  }))

  res.json({ files: result })
})

// GET /api/files/download/:fileId — download/view a file
// Supports JWT from Authorization header OR ?token= query param (for <a href> / <img src>)
router.get('/download/:fileId', (req: Request, res: Response) => {
  const fileId = Number(req.params.fileId)

  // Extract token from header or query
  let userId: number | null = null
  const headerToken = req.headers.authorization?.replace('Bearer ', '')
  const queryToken = req.query.token as string | undefined
  const token = headerToken || queryToken

  if (!token) {
    res.status(401).json({ error: 'Token requerido' })
    return
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    userId = decoded.id
  } catch {
    res.status(401).json({ error: 'Token inválido' })
    return
  }

  const file = db.prepare(`
    SELECT fa.*, e.user_id as expense_owner
    FROM file_attachments fa
    LEFT JOIN expenses e ON fa.expense_id = e.id
    WHERE fa.id = ?
  `).get(fileId) as any

  if (!file) {
    res.status(404).json({ error: 'Archivo no encontrado' })
    return
  }

  if (file.user_id !== userId && file.expense_owner !== userId) {
    res.status(403).json({ error: 'Sin permisos' })
    return
  }

  if (!fs.existsSync(file.file_path)) {
    res.status(404).json({ error: 'Archivo físico no encontrado' })
    return
  }

  if (file.mime_type.startsWith('image/')) {
    res.setHeader('Content-Type', file.mime_type)
    res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`)
  } else {
    res.setHeader('Content-Type', file.mime_type)
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`)
  }
  res.setHeader('Content-Length', file.file_size)

  const stream = fs.createReadStream(file.file_path)
  stream.pipe(res)
})

// DELETE /api/files/:fileId
router.delete('/:fileId', authRequired, (req: AuthRequest, res: Response) => {
  const fileId = Number(req.params.fileId)
  const userId = req.user!.id

  const file = db.prepare('SELECT * FROM file_attachments WHERE id = ?').get(fileId) as any
  if (!file || file.user_id !== userId) {
    res.status(404).json({ error: 'Archivo no encontrado' })
    return
  }

  if (fs.existsSync(file.file_path)) {
    fs.unlinkSync(file.file_path)
  }

  db.prepare('DELETE FROM file_attachments WHERE id = ?').run(fileId)
  res.json({ message: 'Archivo eliminado' })
})

export default router
