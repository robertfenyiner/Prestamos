import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.DB_PATH || './data/robertapp.db'

const dataDir = path.dirname(DB_PATH)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db: Database.Database = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS currencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      exchange_rate REAL DEFAULT 1.0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO currencies (code, name, symbol) VALUES
      ('COP', 'Peso Colombiano', '$'),
      ('USD', 'Dólar Americano', '$'),
      ('EUR', 'Euro', '€'),
      ('CAD', 'Dólar Canadiense', 'C$'),
      ('GBP', 'Libra Esterlina', '£'),
      ('JPY', 'Yen Japonés', '¥'),
      ('MXN', 'Peso Mexicano', '$'),
      ('NGN', 'Naira Nigeriana', '₦'),
      ('TRY', 'Lira Turca', '₺');

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      icon TEXT DEFAULT '📦',
      color TEXT DEFAULT '#6366f1',
      user_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#10b981',
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency_id INTEGER NOT NULL DEFAULT 1 REFERENCES currencies(id),
      amount_cop REAL,
      exchange_rate REAL,
      category_id INTEGER REFERENCES categories(id),
      company_id INTEGER REFERENCES companies(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      date DATE NOT NULL DEFAULT (date('now')),
      is_recurring INTEGER DEFAULT 0,
      recurring_frequency TEXT CHECK(recurring_frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
      next_due_date DATE,
      reminder_days_advance INTEGER DEFAULT 1,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS banks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      rate_ea REAL NOT NULL,
      logo_url TEXT,
      user_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS savings_boxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      bank_id INTEGER NOT NULL REFERENCES banks(id),
      balance REAL DEFAULT 0,
      goal REAL DEFAULT 0,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS savings_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      savings_box_id INTEGER NOT NULL REFERENCES savings_boxes(id),
      type TEXT NOT NULL CHECK(type IN ('deposit', 'withdrawal', 'interest')),
      amount REAL NOT NULL,
      description TEXT,
      date DATE NOT NULL DEFAULT (date('now')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rate_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      savings_box_id INTEGER NOT NULL REFERENCES savings_boxes(id),
      rate_ea REAL NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS file_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
      file_type TEXT NOT NULL DEFAULT 'expense',
      original_name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notification_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      email_enabled INTEGER DEFAULT 1,
      email_address TEXT,
      telegram_enabled INTEGER DEFAULT 0,
      telegram_chat_id TEXT,
      whatsapp_enabled INTEGER DEFAULT 1,
      notify_days_before INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS credit_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'Colombia',
      last_four TEXT,
      network TEXT DEFAULT 'Otra',
      currency_id INTEGER NOT NULL DEFAULT 1 REFERENCES currencies(id),
      credit_limit REAL DEFAULT 0,
      interest_rate_monthly REAL DEFAULT 0,
      interest_rate_annual REAL DEFAULT 0,
      cut_day INTEGER NOT NULL DEFAULT 1,
      payment_due_day INTEGER NOT NULL DEFAULT 15,
      color TEXT DEFAULT '#6366f1',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS credit_card_charges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id INTEGER NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
      expense_id INTEGER REFERENCES expenses(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency_id INTEGER NOT NULL REFERENCES currencies(id),
      amount_cop REAL,
      exchange_rate REAL,
      purchase_date DATE NOT NULL DEFAULT (date('now')),
      installments INTEGER DEFAULT 1,
      interest_rate_monthly REAL DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paid', 'cancelled')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS credit_card_installments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      charge_id INTEGER NOT NULL REFERENCES credit_card_charges(id) ON DELETE CASCADE,
      card_id INTEGER NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
      installment_number INTEGER NOT NULL,
      due_date DATE NOT NULL,
      principal_amount REAL NOT NULL,
      interest_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      paid_at DATETIME,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS credit_card_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id INTEGER NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      currency_id INTEGER NOT NULL REFERENCES currencies(id),
      amount_cop REAL,
      payment_date DATE NOT NULL DEFAULT (date('now')),
      payment_type TEXT DEFAULT 'partial' CHECK(payment_type IN ('minimum', 'full', 'partial', 'advance')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_currency ON expenses(currency_id);
    CREATE INDEX IF NOT EXISTS idx_savings_boxes_user ON savings_boxes(user_id);
    CREATE INDEX IF NOT EXISTS idx_savings_movements_box ON savings_movements(savings_box_id);
    CREATE INDEX IF NOT EXISTS idx_file_attachments_expense ON file_attachments(expense_id);
    CREATE INDEX IF NOT EXISTS idx_file_attachments_user ON file_attachments(user_id);
    CREATE INDEX IF NOT EXISTS idx_credit_cards_user ON credit_cards(user_id);
    CREATE INDEX IF NOT EXISTS idx_credit_card_charges_user ON credit_card_charges(user_id);
    CREATE INDEX IF NOT EXISTS idx_credit_card_charges_card ON credit_card_charges(card_id);
    CREATE INDEX IF NOT EXISTS idx_credit_card_installments_card ON credit_card_installments(card_id);
    CREATE INDEX IF NOT EXISTS idx_credit_card_installments_due ON credit_card_installments(due_date);
    CREATE INDEX IF NOT EXISTS idx_credit_card_payments_card ON credit_card_payments(card_id);
  `)

  ensureColumn('notification_settings', 'whatsapp_enabled', 'INTEGER DEFAULT 1')
  ensureColumn('expenses', 'payment_method', "TEXT DEFAULT 'cash'")
  ensureColumn('expenses', 'credit_card_id', 'INTEGER REFERENCES credit_cards(id)')
  ensureColumn('credit_card_installments', 'paid_amount', 'REAL DEFAULT 0')
  ensureColumn('credit_card_installments', 'paid_at', 'DATETIME')

  console.log('✅ Database initialized')
}

function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!columns.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    console.log(`✅ Added column ${table}.${column}`)
  }
}

export default db
