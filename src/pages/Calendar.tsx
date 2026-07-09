import { useEffect, useMemo, useState } from 'react'
import { Plus, ChevronLeft, ChevronRight, Check, Trash2, Pencil, Users, Repeat } from 'lucide-react'
import { formatCurrency, expandOccurrences, recurrenceLabel } from '../lib/format'
import type { Bill, BillRecurrence, Category, Account, Expense } from '../types'
import { ModalOverlay } from '../components/ModalOverlay'
import { CardMenu } from '../components/CardMenu'

type CalendarItem =
  | {
      kind: 'bill'
      id: string
      date: string
      bill: Bill
    }
  | {
      kind: 'expense'
      id: string
      date: string
      expense: Expense
      occurrenceIndex: number
    }

const EXPENSE_CHIP_COLOR = '#7c6fcf' // iolite — distinct from gold-family bill categories

const RECURRENCE: { value: BillRecurrence; label: string }[] = [
  { value: 'once', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

const todayISO = () => new Date().toISOString().slice(0, 10)
const monthLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const startWeekday = (first.getDay() + 6) % 7 // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: { date: Date; inMonth: boolean }[] = []
  for (let i = 0; i < startWeekday; i++) {
    const d = new Date(year, month, 1 - (startWeekday - i))
    cells.push({ date: d, inMonth: false })
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ date: new Date(year, month, i), inMonth: true })
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1].date
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false })
    if (cells.length >= 42) break
  }
  return cells
}

export function Calendar() {
  const [bills, setBills] = useState<Bill[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Bill | null>(null)
  const [form, setForm] = useState({
    name: '', amount: '', due_date: todayISO(), recurrence: 'monthly' as BillRecurrence,
    category_id: '', account_id: '', notes: ''
  })

  const load = () => {
    window.api.getBills().then(setBills)
    window.api.getExpenses().then(setExpenses)
    window.api.getCategories().then(setCategories)
    window.api.getAccounts().then(setAccounts)
  }

  useEffect(load, [])

  const grid = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor])

  // Visible grid range — the calendar grid spans some days outside the month
  const gridRange = useMemo(() => {
    if (grid.length === 0) return { from: todayISO(), to: todayISO() }
    return {
      from: grid[0].date.toISOString().slice(0, 10),
      to: grid[grid.length - 1].date.toISOString().slice(0, 10),
    }
  }, [grid])

  // Expand recurring expenses into concrete occurrences within the visible grid
  const expenseOccurrences = useMemo<CalendarItem[]>(() => {
    const out: CalendarItem[] = []
    for (const exp of expenses) {
      const anchor = exp.due_date || exp.expense_date
      if (!anchor) continue
      const dates = expandOccurrences(anchor, exp.recurrence, exp.end_date, gridRange.from, gridRange.to)
      dates.forEach((date, idx) => {
        out.push({ kind: 'expense', id: `exp-${exp.id}-${date}`, date, expense: exp, occurrenceIndex: idx })
      })
    }
    return out
  }, [expenses, gridRange])

  const billOccurrences = useMemo<CalendarItem[]>(() => {
    return bills.map(b => ({ kind: 'bill' as const, id: `bill-${b.id}`, date: b.due_date, bill: b }))
  }, [bills])

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    for (const item of [...billOccurrences, ...expenseOccurrences]) {
      const arr = map.get(item.date) || []
      arr.push(item)
      map.set(item.date, arr)
    }
    return map
  }, [billOccurrences, expenseOccurrences])

  const monthItems = useMemo(() => {
    const y = cursor.getFullYear()
    const m = cursor.getMonth()
    return [...billOccurrences, ...expenseOccurrences]
      .filter(item => {
        const d = new Date(item.date + 'T00:00:00')
        return d.getFullYear() === y && d.getMonth() === m
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [billOccurrences, expenseOccurrences, cursor])

  const itemAmount = (it: CalendarItem) => it.kind === 'bill' ? it.bill.amount : it.expense.amount
  const monthTotal = monthItems.reduce((s, it) => s + itemAmount(it), 0)

  const upcoming7 = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const horizon = new Date(now); horizon.setDate(horizon.getDate() + 7)
    const horizonISO = horizon.toISOString().slice(0, 10)
    const todayISOStr = now.toISOString().slice(0, 10)
    const expenseExpansions: CalendarItem[] = []
    for (const exp of expenses) {
      const anchor = exp.due_date || exp.expense_date
      if (!anchor) continue
      const dates = expandOccurrences(anchor, exp.recurrence, exp.end_date, todayISOStr, horizonISO)
      dates.forEach((date, idx) => expenseExpansions.push({
        kind: 'expense', id: `exp-${exp.id}-${date}`, date, expense: exp, occurrenceIndex: idx,
      }))
    }
    const billItems = bills
      .filter(b => {
        const d = new Date(b.due_date + 'T00:00:00')
        return d >= now && d <= horizon
      })
      .map(b => ({ kind: 'bill' as const, id: `bill-${b.id}`, date: b.due_date, bill: b }))
    return [...billItems, ...expenseExpansions]
  }, [bills, expenses])
  const upcoming7Total = upcoming7.reduce((s, it) => s + itemAmount(it), 0)
  const activeCount = bills.length + expenses.length

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', amount: '', due_date: todayISO(), recurrence: 'monthly', category_id: '', account_id: '', notes: '' })
    setShowModal(true)
  }

  const openEdit = (b: Bill) => {
    setEditing(b)
    setForm({
      name: b.name, amount: String(b.amount), due_date: b.due_date, recurrence: b.recurrence,
      category_id: b.category_id ? String(b.category_id) : '',
      account_id: b.account_id ? String(b.account_id) : '',
      notes: b.notes || ''
    })
    setShowModal(true)
  }

  const save = async () => {
    const payload = {
      name: form.name,
      amount: parseFloat(form.amount) || 0,
      due_date: form.due_date,
      recurrence: form.recurrence,
      category_id: form.category_id ? parseInt(form.category_id) : null,
      account_id: form.account_id ? parseInt(form.account_id) : null,
      notes: form.notes || null,
    }
    if (editing) await window.api.updateBill(editing.id, payload)
    else await window.api.addBill(payload)
    setShowModal(false)
    load()
  }

  const remove = async (id: number) => {
    if (confirm('Delete this bill?')) {
      await window.api.deleteBill(id)
      load()
    }
  }

  const pay = async (id: number) => {
    await window.api.payBill(id)
    load()
  }

  const isToday = (d: Date) => d.toDateString() === new Date().toDateString()

  return (
    <div className="page calendar-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-subtitle">Bills and expense schedules</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Add Bill</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">This Month</div>
          <div className="stat-value negative">{formatCurrency(monthTotal)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Due in 7 Days</div>
          <div className="stat-value accent">{formatCurrency(upcoming7Total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Items</div>
          <div className="stat-value">{activeCount}</div>
          <div className="stat-meta" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {bills.length} bill{bills.length !== 1 ? 's' : ''} · {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="calendar-layout">
        <div className="card calendar-card">
          <div className="calendar-toolbar">
            <button className="btn btn-ghost btn-sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
            <h3 className="calendar-month">{monthLabel(cursor)}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
            <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)) }}>Today</button>
          </div>
          <div className="calendar-grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="calendar-weekday">{d}</div>)}
            {grid.map((cell, i) => {
              const iso = cell.date.toISOString().slice(0, 10)
              const cellItems = itemsByDate.get(iso) || []
              return (
                <div key={i} className={`calendar-cell ${cell.inMonth ? '' : 'out-of-month'} ${isToday(cell.date) ? 'is-today' : ''}`}>
                  <div className="calendar-cell-date">{cell.date.getDate()}</div>
                  <div className="calendar-cell-bills">
                    {cellItems.slice(0, 3).map(item => {
                      if (item.kind === 'bill') {
                        return (
                          <div
                            key={item.id}
                            className="calendar-bill-chip"
                            style={{ background: item.bill.category_color || 'var(--accent-subtle)' }}
                            title={`${item.bill.name} — ${formatCurrency(item.bill.amount)}`}
                          >
                            {item.bill.name}
                          </div>
                        )
                      }
                      const exp = item.expense
                      const recurring = exp.recurrence && exp.recurrence !== 'once'
                      return (
                        <div
                          key={item.id}
                          className="calendar-bill-chip"
                          style={{ background: EXPENSE_CHIP_COLOR, color: '#fff', display: 'flex', alignItems: 'center', gap: 3 }}
                          title={`${exp.name} — ${formatCurrency(exp.amount)}${recurring ? ` · ${recurrenceLabel(exp.recurrence)}` : ''}`}
                        >
                          {recurring ? <Repeat size={9} /> : <Users size={9} />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{exp.name}</span>
                        </div>
                      )
                    })}
                    {cellItems.length > 3 && <div className="calendar-bill-more">+{cellItems.length - 3}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card calendar-side">
          <div className="card-header"><h3 className="card-title">{monthLabel(cursor)} Schedule</h3></div>
          {monthItems.length === 0 ? (
            <div className="empty-state"><p>Nothing scheduled this month</p></div>
          ) : (
            <div className="bill-list">
              {monthItems.map(item => {
                const dateLabel = new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                if (item.kind === 'bill') {
                  const b = item.bill
                  return (
                    <div key={item.id} className="bill-row">
                      <div className="bill-row-main">
                        <div className="bill-row-name">{b.name}</div>
                        <div className="bill-row-meta">
                          {dateLabel}
                          {' · '}{recurrenceLabel(b.recurrence)}
                          {b.category_name && <> · <span style={{ color: b.category_color || 'inherit' }}>{b.category_name}</span></>}
                        </div>
                      </div>
                      <div className="bill-row-amount amount amount-negative">{formatCurrency(b.amount)}</div>
                      <div className="bill-row-actions">
                        <button className="btn btn-ghost btn-sm" title="Mark paid" onClick={() => pay(b.id)}><Check size={14} /></button>
                        <CardMenu
                          items={[
                            { label: 'Edit', icon: <Pencil size={14} />, onClick: () => openEdit(b) },
                            { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => remove(b.id), danger: true },
                          ]}
                        />
                      </div>
                    </div>
                  )
                }
                const exp = item.expense
                const recurring = exp.recurrence && exp.recurrence !== 'once'
                return (
                  <div key={item.id} className="bill-row">
                    <div className="bill-row-main">
                      <div className="bill-row-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          title="Family expense"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 16, height: 16,
                            borderRadius: 4,
                            background: EXPENSE_CHIP_COLOR,
                            color: '#fff',
                          }}
                        >
                          {recurring ? <Repeat size={9} /> : <Users size={9} />}
                        </span>
                        {exp.name}
                      </div>
                      <div className="bill-row-meta">
                        {dateLabel}
                        {' · '}{recurrenceLabel(exp.recurrence)}
                        {' · '}Expense
                        {exp.payers.length > 0 && (
                          <> · paid by {exp.payers.map(p => p.member_name.split(' ')[0]).join(', ')}</>
                        )}
                      </div>
                    </div>
                    <div className="bill-row-amount amount amount-negative">{formatCurrency(exp.amount)}</div>
                    <div className="bill-row-actions" />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <ModalOverlay open={showModal} onClose={() => setShowModal(false)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h2 className="modal-title">{editing ? 'Edit Bill' : 'New Bill'}</h2>

            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" placeholder="e.g. Rent, Netflix" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input className="form-input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Recurrence</label>
                <select className="form-select" value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value as BillRecurrence })}>
                  {RECURRENCE.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">None</option>
                  {categories.filter(c => c.type === 'expense').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Pay From Account</label>
              <select className="form-select" value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })}>
                <option value="">None (track only)</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" placeholder="Optional" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!form.name || !form.amount}>{editing ? 'Save' : 'Add Bill'}</button>
            </div>
        </div>
      </ModalOverlay>
    </div>
  )
}
