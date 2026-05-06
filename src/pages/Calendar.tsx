import { useEffect, useMemo, useState } from 'react'
import { Plus, ChevronLeft, ChevronRight, Check, Trash2, Pencil } from 'lucide-react'
import { formatCurrency } from '../lib/format'
import type { Bill, BillRecurrence, Category, Account } from '../types'

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
    window.api.getCategories().then(setCategories)
    window.api.getAccounts().then(setAccounts)
  }

  useEffect(load, [])

  const grid = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor])

  const billsByDate = useMemo(() => {
    const map = new Map<string, Bill[]>()
    for (const b of bills) {
      const arr = map.get(b.due_date) || []
      arr.push(b)
      map.set(b.due_date, arr)
    }
    return map
  }, [bills])

  const monthBills = useMemo(() => {
    const y = cursor.getFullYear()
    const m = cursor.getMonth()
    return bills.filter(b => {
      const d = new Date(b.due_date + 'T00:00:00')
      return d.getFullYear() === y && d.getMonth() === m
    }).sort((a, b) => a.due_date.localeCompare(b.due_date))
  }, [bills, cursor])

  const monthTotal = monthBills.reduce((s, b) => s + b.amount, 0)
  const upcoming7 = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const horizon = new Date(now); horizon.setDate(horizon.getDate() + 7)
    return bills.filter(b => {
      const d = new Date(b.due_date + 'T00:00:00')
      return d >= now && d <= horizon
    })
  }, [bills])
  const upcoming7Total = upcoming7.reduce((s, b) => s + b.amount, 0)

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
          <p className="page-subtitle">Bills and due dates</p>
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
          <div className="stat-label">Active Bills</div>
          <div className="stat-value">{bills.length}</div>
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
              const cellBills = billsByDate.get(iso) || []
              return (
                <div key={i} className={`calendar-cell ${cell.inMonth ? '' : 'out-of-month'} ${isToday(cell.date) ? 'is-today' : ''}`}>
                  <div className="calendar-cell-date">{cell.date.getDate()}</div>
                  <div className="calendar-cell-bills">
                    {cellBills.slice(0, 3).map(b => (
                      <div key={b.id} className="calendar-bill-chip" style={{ background: b.category_color || 'var(--accent-subtle)' }} title={`${b.name} — ${formatCurrency(b.amount)}`}>
                        {b.name}
                      </div>
                    ))}
                    {cellBills.length > 3 && <div className="calendar-bill-more">+{cellBills.length - 3}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card calendar-side">
          <div className="card-header"><h3 className="card-title">{monthLabel(cursor)} Bills</h3></div>
          {monthBills.length === 0 ? (
            <div className="empty-state"><p>No bills this month</p></div>
          ) : (
            <div className="bill-list">
              {monthBills.map(b => (
                <div key={b.id} className="bill-row">
                  <div className="bill-row-main">
                    <div className="bill-row-name">{b.name}</div>
                    <div className="bill-row-meta">
                      {new Date(b.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' · '}{b.recurrence}
                      {b.category_name && <> · <span style={{ color: b.category_color || 'inherit' }}>{b.category_name}</span></>}
                    </div>
                  </div>
                  <div className="bill-row-amount amount amount-negative">{formatCurrency(b.amount)}</div>
                  <div className="bill-row-actions">
                    <button className="btn btn-ghost btn-sm" title="Mark paid" onClick={() => pay(b.id)}><Check size={14} /></button>
                    <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => openEdit(b)}><Pencil size={14} /></button>
                    <button className="btn btn-ghost btn-sm" title="Delete" onClick={() => remove(b.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
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
        </div>
      )}
    </div>
  )
}
