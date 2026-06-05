import { Router, Response } from 'express'
import db from '../../database'
import { authRequired, type AuthRequest } from '../../middleware/auth'

const router = Router()

router.use(authRequired)

type ClientRow = {
  id: number
  user_id: number
  name: string
  document?: string | null
  phone?: string | null
  alternate_phone?: string | null
  address?: string | null
  reference_name?: string | null
  reference_phone?: string | null
  notes?: string | null
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

function getClient(id: number | string, userId: number) {
  return db.prepare('SELECT * FROM clients WHERE id = ? AND user_id = ?').get(id, userId) as ClientRow | undefined
}

function cleanText(value: unknown) {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

// GET /api/clientes — list clients
router.get('/', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const { search, status = 'all', limit = '100', offset = '0' } = req.query

  let query = 'SELECT * FROM clients WHERE user_id = ?'
  const params: any[] = [userId]

  if (status && status !== 'all') {
    query += ' AND status = ?'
    params.push(String(status))
  }

  if (search) {
    query += ` AND (
      name LIKE ? OR
      COALESCE(document, '') LIKE ? OR
      COALESCE(phone, '') LIKE ? OR
      COALESCE(address, '') LIKE ?
    )`
    const term = `%${search}%`
    params.push(term, term, term, term)
  }

  query += ' ORDER BY status ASC, name COLLATE NOCASE ASC LIMIT ? OFFSET ?'
  params.push(Number(limit), Number(offset))

  const clients = db.prepare(query).all(...params)

  let countQuery = 'SELECT COUNT(*) as total FROM clients WHERE user_id = ?'
  const countParams: any[] = [userId]
  if (status && status !== 'all') {
    countQuery += ' AND status = ?'
    countParams.push(String(status))
  }
  if (search) {
    countQuery += ` AND (
      name LIKE ? OR
      COALESCE(document, '') LIKE ? OR
      COALESCE(phone, '') LIKE ? OR
      COALESCE(address, '') LIKE ?
    )`
    const term = `%${search}%`
    countParams.push(term, term, term, term)
  }

  const summary = db.prepare(countQuery).get(...countParams) as { total: number }
  const totals = db.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) as active,
      COALESCE(SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END), 0) as inactive
    FROM clients WHERE user_id = ?
  `).get(userId) as { total: number; active: number; inactive: number }

  res.json({ clients, total: summary.total, summary: totals })
})

// GET /api/clientes/:id — get client detail
router.get('/:id', (req: AuthRequest, res: Response) => {
  const id = String(req.params.id)
  const client = getClient(id, req.user!.id)
  if (!client) {
    res.status(404).json({ error: 'Cliente no encontrado' })
    return
  }
  res.json(client)
})

// POST /api/clientes — create client
router.post('/', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const {
    name,
    document,
    phone,
    alternate_phone,
    address,
    reference_name,
    reference_phone,
    notes,
    status = 'active',
  } = req.body

  const cleanName = cleanText(name)
  if (!cleanName) {
    res.status(400).json({ error: 'Nombre del cliente requerido' })
    return
  }

  if (!['active', 'inactive'].includes(String(status))) {
    res.status(400).json({ error: 'Estado no válido' })
    return
  }

  const result = db.prepare(`
    INSERT INTO clients (
      user_id, name, document, phone, alternate_phone, address,
      reference_name, reference_phone, notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    cleanName,
    cleanText(document),
    cleanText(phone),
    cleanText(alternate_phone),
    cleanText(address),
    cleanText(reference_name),
    cleanText(reference_phone),
    cleanText(notes),
    status,
  )

  const client = getClient(Number(result.lastInsertRowid), userId)
  res.status(201).json(client)
})

// PUT /api/clientes/:id — update client
router.put('/:id', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const { id: rawId } = req.params
  const id = String(rawId)
  const existing = getClient(id, userId)
  if (!existing) {
    res.status(404).json({ error: 'Cliente no encontrado' })
    return
  }

  const {
    name,
    document,
    phone,
    alternate_phone,
    address,
    reference_name,
    reference_phone,
    notes,
    status,
  } = req.body

  if (name !== undefined && !cleanText(name)) {
    res.status(400).json({ error: 'Nombre del cliente requerido' })
    return
  }

  if (status !== undefined && !['active', 'inactive'].includes(String(status))) {
    res.status(400).json({ error: 'Estado no válido' })
    return
  }

  db.prepare(`
    UPDATE clients SET
      name = COALESCE(?, name),
      document = ?,
      phone = ?,
      alternate_phone = ?,
      address = ?,
      reference_name = ?,
      reference_phone = ?,
      notes = ?,
      status = COALESCE(?, status),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(
    name !== undefined ? cleanText(name) : null,
    document !== undefined ? cleanText(document) : existing.document,
    phone !== undefined ? cleanText(phone) : existing.phone,
    alternate_phone !== undefined ? cleanText(alternate_phone) : existing.alternate_phone,
    address !== undefined ? cleanText(address) : existing.address,
    reference_name !== undefined ? cleanText(reference_name) : existing.reference_name,
    reference_phone !== undefined ? cleanText(reference_phone) : existing.reference_phone,
    notes !== undefined ? cleanText(notes) : existing.notes,
    status !== undefined ? status : null,
    id,
    userId,
  )

  res.json(getClient(id, userId))
})

// DELETE /api/clientes/:id — soft deactivate client
router.delete('/:id', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const { id: rawId } = req.params
  const id = String(rawId)
  const existing = getClient(id, userId)
  if (!existing) {
    res.status(404).json({ error: 'Cliente no encontrado' })
    return
  }

  db.prepare(`
    UPDATE clients
    SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(id, userId)

  res.json({ message: 'Cliente desactivado', client: getClient(id, userId) })
})

export default router
