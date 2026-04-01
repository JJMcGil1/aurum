import BetterSqlite3 from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

export class Database {
  private db: BetterSqlite3.Database
  public profileImagesDir: string

  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'aurum.db')
    this.profileImagesDir = path.join(app.getPath('userData'), 'profile-images')
    if (!fs.existsSync(this.profileImagesDir)) {
      fs.mkdirSync(this.profileImagesDir, { recursive: true })
    }
    this.db = new BetterSqlite3(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.init()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS family_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'member',
        avatar_color TEXT NOT NULL DEFAULT '#6366f1',
        avatar_image TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('checking', 'savings', 'credit_card', 'investment', 'cash', 'loan')),
        balance REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        institution TEXT,
        owner_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        icon TEXT,
        color TEXT NOT NULL DEFAULT '#6366f1'
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer')),
        description TEXT NOT NULL,
        date TEXT NOT NULL,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        family_member_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS expense_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('beneficiary', 'payer')),
        amount REAL
      );

      CREATE INDEX IF NOT EXISTS idx_expense_members_expense ON expense_members(expense_id);
      CREATE INDEX IF NOT EXISTS idx_expense_members_member ON expense_members(member_id);
    `)

    // Migrate old schema: if 'name' column exists but 'first_name' doesn't, migrate
    const cols = this.db.prepare("PRAGMA table_info(family_members)").all() as any[]
    const hasFirstName = cols.some((c: any) => c.name === 'first_name')
    const hasOldName = cols.some((c: any) => c.name === 'name')
    if (hasOldName && hasFirstName) {
      // Previous migration added first_name/last_name but didn't drop name — fix it
      this.db.exec('ALTER TABLE family_members DROP COLUMN name')
    } else if (hasOldName && !hasFirstName) {
      this.db.exec(`ALTER TABLE family_members ADD COLUMN first_name TEXT NOT NULL DEFAULT ''`)
      this.db.exec(`ALTER TABLE family_members ADD COLUMN last_name TEXT NOT NULL DEFAULT ''`)
      this.db.exec(`ALTER TABLE family_members ADD COLUMN avatar_image TEXT`)
      // Split old name into first/last
      const rows = this.db.prepare('SELECT id, name FROM family_members').all() as any[]
      const update = this.db.prepare('UPDATE family_members SET first_name = ?, last_name = ? WHERE id = ?')
      for (const row of rows) {
        const parts = row.name.trim().split(/\s+/)
        const first = parts[0] || ''
        const last = parts.slice(1).join(' ')
        update.run(first, last, row.id)
      }
      // Drop the old name column so INSERTs don't fail on NOT NULL
      this.db.exec('ALTER TABLE family_members DROP COLUMN name')
    }

    // Migrate expenses: if old schema has 'date' column, recreate without it
    const expCols = this.db.prepare("PRAGMA table_info(expenses)").all() as any[]
    const hasDate = expCols.some((c: any) => c.name === 'date')
    if (hasDate) {
      this.db.exec(`
        DROP TABLE IF EXISTS expense_members;
        DROP TABLE IF EXISTS expenses;
        CREATE TABLE expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          amount REAL NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE expense_members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
          member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK(role IN ('beneficiary', 'payer')),
          amount REAL
        );
        CREATE INDEX idx_expense_members_expense ON expense_members(expense_id);
        CREATE INDEX idx_expense_members_member ON expense_members(member_id);
      `)
    }

    // Seed default categories if empty
    const count = this.db.prepare('SELECT COUNT(*) as c FROM categories').get() as any
    if (count.c === 0) {
      const insert = this.db.prepare('INSERT INTO categories (name, type, color) VALUES (?, ?, ?)')
      const defaults = [
        ['Salary', 'income', '#22c55e'],
        ['Freelance', 'income', '#10b981'],
        ['Investments', 'income', '#06b6d4'],
        ['Gifts Received', 'income', '#8b5cf6'],
        ['Groceries', 'expense', '#ef4444'],
        ['Dining Out', 'expense', '#f97316'],
        ['Transportation', 'expense', '#eab308'],
        ['Utilities', 'expense', '#64748b'],
        ['Entertainment', 'expense', '#ec4899'],
        ['Shopping', 'expense', '#a855f7'],
        ['Healthcare', 'expense', '#14b8a6'],
        ['Education', 'expense', '#3b82f6'],
        ['Housing', 'expense', '#78716c'],
        ['Insurance', 'expense', '#6366f1'],
        ['Subscriptions', 'expense', '#f43f5e'],
      ]
      const insertMany = this.db.transaction((items: string[][]) => {
        for (const item of items) insert.run(...item)
      })
      insertMany(defaults)
    }
  }

  // Family Members
  getFamilyMembers() {
    return this.db.prepare(`
      SELECT *, (first_name || ' ' || last_name) AS name FROM family_members ORDER BY created_at
    `).all().map((m: any) => ({ ...m, name: m.name.trim() }))
  }

  addFamilyMember(member: { first_name: string; last_name: string; role: string; avatar_color: string; avatar_image?: string }) {
    const stmt = this.db.prepare('INSERT INTO family_members (first_name, last_name, role, avatar_color, avatar_image) VALUES (?, ?, ?, ?, ?)')
    const result = stmt.run(member.first_name, member.last_name || '', member.role, member.avatar_color, member.avatar_image || null)
    return this.db.prepare('SELECT *, (first_name || \' \' || last_name) AS name FROM family_members WHERE id = ?').get(result.lastInsertRowid)
  }

  updateFamilyMember(id: number, member: { first_name?: string; last_name?: string; role?: string; avatar_color?: string; avatar_image?: string | null }) {
    const fields: string[] = []
    const values: any[] = []
    if (member.first_name !== undefined) { fields.push('first_name = ?'); values.push(member.first_name) }
    if (member.last_name !== undefined) { fields.push('last_name = ?'); values.push(member.last_name) }
    if (member.role !== undefined) { fields.push('role = ?'); values.push(member.role) }
    if (member.avatar_color !== undefined) { fields.push('avatar_color = ?'); values.push(member.avatar_color) }
    if (member.avatar_image !== undefined) { fields.push('avatar_image = ?'); values.push(member.avatar_image) }
    if (fields.length === 0) return this.db.prepare('SELECT *, (first_name || \' \' || last_name) AS name FROM family_members WHERE id = ?').get(id)
    values.push(id)
    this.db.prepare(`UPDATE family_members SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.db.prepare('SELECT *, (first_name || \' \' || last_name) AS name FROM family_members WHERE id = ?').get(id)
  }

  deleteFamilyMember(id: number) {
    // Clean up profile image if it exists
    const member = this.db.prepare('SELECT avatar_image FROM family_members WHERE id = ?').get(id) as any
    if (member?.avatar_image && fs.existsSync(member.avatar_image)) {
      fs.unlinkSync(member.avatar_image)
    }
    this.db.prepare('DELETE FROM family_members WHERE id = ?').run(id)
  }

  // Accounts
  getAccounts() {
    return this.db.prepare(`
      SELECT a.*, TRIM(fm.first_name || ' ' || fm.last_name) as owner_name
      FROM accounts a
      LEFT JOIN family_members fm ON a.owner_id = fm.id
      ORDER BY a.type, a.name
    `).all()
  }

  addAccount(account: { name: string; type: string; balance: number; currency: string; institution?: string; owner_id?: number }) {
    const stmt = this.db.prepare('INSERT INTO accounts (name, type, balance, currency, institution, owner_id) VALUES (?, ?, ?, ?, ?, ?)')
    const result = stmt.run(account.name, account.type, account.balance, account.currency, account.institution || null, account.owner_id || null)
    return { id: result.lastInsertRowid, ...account }
  }

  updateAccount(id: number, account: Partial<{ name: string; type: string; balance: number; currency: string; institution: string; owner_id: number }>) {
    const fields: string[] = []
    const values: any[] = []
    for (const [key, val] of Object.entries(account)) {
      if (val !== undefined) { fields.push(`${key} = ?`); values.push(val) }
    }
    values.push(id)
    this.db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id)
  }

  deleteAccount(id: number) {
    this.db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
  }

  // Transactions
  getTransactions(filters?: { account_id?: number; category_id?: number; family_member_id?: number; type?: string; from_date?: string; to_date?: string; limit?: number; offset?: number }) {
    let where = 'WHERE 1=1'
    const params: any[] = []

    if (filters?.account_id) { where += ' AND t.account_id = ?'; params.push(filters.account_id) }
    if (filters?.category_id) { where += ' AND t.category_id = ?'; params.push(filters.category_id) }
    if (filters?.family_member_id) { where += ' AND t.family_member_id = ?'; params.push(filters.family_member_id) }
    if (filters?.type) { where += ' AND t.type = ?'; params.push(filters.type) }
    if (filters?.from_date) { where += ' AND t.date >= ?'; params.push(filters.from_date) }
    if (filters?.to_date) { where += ' AND t.date <= ?'; params.push(filters.to_date) }

    const limit = filters?.limit || 100
    const offset = filters?.offset || 0

    const rows = this.db.prepare(`
      SELECT t.*, a.name as account_name, c.name as category_name, c.color as category_color, TRIM(fm.first_name || ' ' || fm.last_name) as family_member_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN family_members fm ON t.family_member_id = fm.id
      ${where}
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset)

    const total = this.db.prepare(`SELECT COUNT(*) as c FROM transactions t ${where}`).get(...params) as any

    return { rows, total: total.c }
  }

  addTransaction(tx: { amount: number; type: string; description: string; date: string; account_id: number; category_id?: number; family_member_id?: number; notes?: string }) {
    const stmt = this.db.prepare('INSERT INTO transactions (amount, type, description, date, account_id, category_id, family_member_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    const result = stmt.run(tx.amount, tx.type, tx.description, tx.date, tx.account_id, tx.category_id || null, tx.family_member_id || null, tx.notes || null)

    // Update account balance
    if (tx.type === 'expense') {
      this.db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(tx.amount, tx.account_id)
    } else if (tx.type === 'income') {
      this.db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(tx.amount, tx.account_id)
    }

    return { id: result.lastInsertRowid, ...tx }
  }

  updateTransaction(id: number, tx: Partial<{ amount: number; type: string; description: string; date: string; account_id: number; category_id: number; family_member_id: number; notes: string }>) {
    // Get old transaction to reverse balance
    const old = this.db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any
    if (old) {
      if (old.type === 'expense') {
        this.db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(old.amount, old.account_id)
      } else if (old.type === 'income') {
        this.db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(old.amount, old.account_id)
      }
    }

    const fields: string[] = []
    const values: any[] = []
    for (const [key, val] of Object.entries(tx)) {
      if (val !== undefined) { fields.push(`${key} = ?`); values.push(val) }
    }
    values.push(id)
    this.db.prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    // Apply new balance
    const updated = this.db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any
    if (updated) {
      if (updated.type === 'expense') {
        this.db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(updated.amount, updated.account_id)
      } else if (updated.type === 'income') {
        this.db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(updated.amount, updated.account_id)
      }
    }

    return updated
  }

  deleteTransaction(id: number) {
    const tx = this.db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any
    if (tx) {
      if (tx.type === 'expense') {
        this.db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(tx.amount, tx.account_id)
      } else if (tx.type === 'income') {
        this.db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(tx.amount, tx.account_id)
      }
    }
    this.db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
  }

  // Categories
  getCategories() {
    return this.db.prepare('SELECT * FROM categories ORDER BY type, name').all()
  }

  addCategory(cat: { name: string; type: string; color: string }) {
    const stmt = this.db.prepare('INSERT INTO categories (name, type, color) VALUES (?, ?, ?)')
    const result = stmt.run(cat.name, cat.type, cat.color)
    return { id: result.lastInsertRowid, ...cat }
  }

  deleteCategory(id: number) {
    this.db.prepare('DELETE FROM categories WHERE id = ?').run(id)
  }

  // Expenses
  getExpenses() {
    const expenses = this.db.prepare(`
      SELECT * FROM expenses ORDER BY created_at DESC
    `).all() as any[]

    return expenses.map((exp: any) => {
      const members = this.db.prepare(`
        SELECT em.*, TRIM(fm.first_name || ' ' || fm.last_name) as member_name, fm.avatar_color, fm.avatar_image, fm.role as member_role
        FROM expense_members em
        JOIN family_members fm ON em.member_id = fm.id
        WHERE em.expense_id = ?
      `).all(exp.id)

      return {
        ...exp,
        beneficiaries: (members as any[]).filter((m: any) => m.role === 'beneficiary'),
        payers: (members as any[]).filter((m: any) => m.role === 'payer'),
      }
    })
  }

  addExpense(expense: { name: string; amount: number; notes?: string; beneficiary_ids: number[]; payers: { member_id: number; amount: number }[] }) {
    const insertExpense = this.db.prepare('INSERT INTO expenses (name, amount, notes) VALUES (?, ?, ?)')
    const insertMember = this.db.prepare('INSERT INTO expense_members (expense_id, member_id, role, amount) VALUES (?, ?, ?, ?)')

    const result = this.db.transaction(() => {
      const res = insertExpense.run(expense.name, expense.amount, expense.notes || null)
      const expenseId = res.lastInsertRowid

      for (const id of expense.beneficiary_ids) {
        insertMember.run(expenseId, id, 'beneficiary', null)
      }
      for (const payer of expense.payers) {
        insertMember.run(expenseId, payer.member_id, 'payer', payer.amount)
      }

      return expenseId
    })()

    return this.getExpenseById(result as number)
  }

  updateExpense(id: number, expense: { name: string; amount: number; notes?: string; beneficiary_ids: number[]; payers: { member_id: number; amount: number }[] }) {
    const updateExp = this.db.prepare('UPDATE expenses SET name = ?, amount = ?, notes = ? WHERE id = ?')
    const deleteMembersStmt = this.db.prepare('DELETE FROM expense_members WHERE expense_id = ?')
    const insertMember = this.db.prepare('INSERT INTO expense_members (expense_id, member_id, role, amount) VALUES (?, ?, ?, ?)')

    this.db.transaction(() => {
      updateExp.run(expense.name, expense.amount, expense.notes || null, id)
      deleteMembersStmt.run(id)

      for (const memberId of expense.beneficiary_ids) {
        insertMember.run(id, memberId, 'beneficiary', null)
      }
      for (const payer of expense.payers) {
        insertMember.run(id, payer.member_id, 'payer', payer.amount)
      }
    })()

    return this.getExpenseById(id)
  }

  deleteExpense(id: number) {
    this.db.prepare('DELETE FROM expenses WHERE id = ?').run(id)
  }

  private getExpenseById(id: number) {
    const exp = this.db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as any
    if (!exp) return null

    const members = this.db.prepare(`
      SELECT em.*, TRIM(fm.first_name || ' ' || fm.last_name) as member_name, fm.avatar_color, fm.avatar_image, fm.role as member_role
      FROM expense_members em
      JOIN family_members fm ON em.member_id = fm.id
      WHERE em.expense_id = ?
    `).all(id)

    return {
      ...exp,
      beneficiaries: (members as any[]).filter((m: any) => m.role === 'beneficiary'),
      payers: (members as any[]).filter((m: any) => m.role === 'payer'),
    }
  }

  getNonPetMembers() {
    return this.db.prepare(`
      SELECT *, (first_name || ' ' || last_name) AS name FROM family_members
      WHERE role != 'Pet'
      ORDER BY created_at
    `).all().map((m: any) => ({ ...m, name: m.name.trim() }))
  }

  // Dashboard — expenses-only
  getDashboardData() {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`

    // Aggregate stats from expenses table
    const totals = this.db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses`
    ).get() as any

    const monthlyTotal = this.db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE created_at >= ? AND created_at < ?`
    ).get(monthStart + ' 00:00:00', monthEnd + ' 23:59:59') as any

    // Recent expenses with payer names
    const recentExpenses = this.db.prepare(`
      SELECT e.id, e.name, e.amount, e.created_at,
        GROUP_CONCAT(TRIM(fm.first_name || ' ' || fm.last_name), ', ') as payers
      FROM expenses e
      LEFT JOIN expense_members em ON em.expense_id = e.id AND em.role = 'payer'
      LEFT JOIN family_members fm ON em.member_id = fm.id
      GROUP BY e.id
      ORDER BY e.created_at DESC
      LIMIT 10
    `).all()

    // Monthly trend (last 6 months) — expenses only
    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-31`

      const expenses = this.db.prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE created_at >= ? AND created_at < ?`
      ).get(start + ' 00:00:00', end + ' 23:59:59') as any

      monthlyTrend.push({
        month: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        expenses: expenses.total
      })
    }

    // Spending by family member (current month) — payers only
    const spendingByMember = this.db.prepare(`
      SELECT TRIM(fm.first_name || ' ' || fm.last_name) as name, fm.avatar_color, SUM(em.amount) as total
      FROM expense_members em
      JOIN expenses e ON em.expense_id = e.id
      JOIN family_members fm ON em.member_id = fm.id
      WHERE em.role = 'payer' AND e.created_at >= ? AND e.created_at < ?
      GROUP BY fm.id
      ORDER BY total DESC
    `).all(monthStart + ' 00:00:00', monthEnd + ' 23:59:59')

    return {
      totalExpenses: totals.total,
      monthlyExpenses: monthlyTotal.total,
      expenseCount: totals.count,
      averageExpense: totals.count > 0 ? totals.total / totals.count : 0,
      recentExpenses,
      monthlyTrend,
      spendingByMember
    }
  }
}
