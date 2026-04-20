import db from './index'

console.log('🧹 Limpiando base de datos para pruebas...')

// Iniciamos una transacción para que sea seguro
const clearData = db.transaction(() => {
  // Borrar movimientos e hijos primero
  db.prepare('DELETE FROM file_attachments').run()
  db.prepare('DELETE FROM savings_movements').run()
  db.prepare('DELETE FROM rate_history').run()
  
  // Borrar padres
  db.prepare('DELETE FROM expenses').run()
  db.prepare('DELETE FROM savings_boxes').run()

  // Opcional: Reiniciar los contadores de ID
  db.prepare("DELETE FROM sqlite_sequence WHERE name='savings_movements'").run()
  db.prepare("DELETE FROM sqlite_sequence WHERE name='expenses'").run()
  db.prepare("DELETE FROM sqlite_sequence WHERE name='savings_boxes'").run()
  db.prepare("DELETE FROM sqlite_sequence WHERE name='file_attachments'").run()
  db.prepare("DELETE FROM sqlite_sequence WHERE name='rate_history'").run()
})

try {
  clearData()
  console.log('✅ Base de datos limpiada correctamente.')
  console.log('Mantuvimos: Usuario, Bancos, Categorías y Monedas.')
} catch (error) {
  console.error('❌ Error al limpiar la base de datos:', error)
}
