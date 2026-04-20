import db from './index'

console.log('Migrando base de datos para agregar "Empresas"...')

try {
  // Crear tabla de empresas
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#10b981',
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)
  
  // Agregar columna company_id a expenses
  try {
    db.prepare('ALTER TABLE expenses ADD COLUMN company_id INTEGER REFERENCES companies(id)').run()
    console.log('✅ Columna company_id agregada a expenses')
  } catch (e: any) {
    if (e.message.includes('duplicate column name')) {
      console.log('✅ La columna company_id ya existe en expenses')
    } else {
      throw e
    }
  }

  // Insertar una empresa por defecto para no dejar nulos si el usuario quiere
  console.log('✅ Migración de empresas completada exitosamente')
} catch (e) {
  console.error('❌ Error en la migración:', e)
}
