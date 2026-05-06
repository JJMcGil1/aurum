import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { formatCurrency } from '../lib/format'
import type { Budget, BudgetPeriod, Category } from '../types'

const PERIODS: { value: BudgetPeriod; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

export function Budgets() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [form, setForm] = useState({ category_id: '', amount: '', period: 'monthly' as BudgetPeriod })

  const load = () => {
    window.api.getBudgets().then(setBudgets)
    window.api.getCategories().then(setCategories)
  }

  useEffect(load, [])

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0)
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0)
  const remaining = totalBudgeted - totalSpent

  const usedCategoryIds = new Set(budgets.map(b => b.category_id))
  const availableCategories = categories.filter(c => c.type === 'expense' && (!usedCategoryIds.has(c.id) || (editing && editing.category_id === c.id)))

  const openNew = () => {
    setEditing(null)
    setForm({ category_id: '', amount: '', period: 'monthly' })
    setShowModal(true)
  }

  const openEdit = (b: Budget) => {
    setEditing(b)
    setForm({ category_id: String(b.category_id), amount: String(b.amount), period: b.period })
    setShowModal(true)
  }

  const save = async () => {
    const amount = parseFloat(form.amount) || 0
    if (editing) {
      await window.api.updateBudget(editing.id, { amount, period: form.period })
    } else {
      await window.api.addBudget({ category_id: parseInt(form.category_id), amount, period: form.period })
    }
    setShowModal(false)
    load()
  }

  const remove = async (id: number) => {
    if (confirm('Delete this budget?')) {
      await window.api.deleteBudget(id)
      load()
    }
  }

  const status = (b: Budget): { label: string; pct: number; tone: 'ok' | 'warn' | 'over' } => {
    const pct = b.amount > 0 ? (b.spent / b.amount) * 100 : 0
    if (pct >= 100) return { label: 'Over', pct: 100, tone: 'over' }
    if (pct >= 80) return { label: 'Tight', pct, tone: 'warn' }
    return { label: 'On track', pct, tone: 'ok' }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Budgets</h1>
          <p className="page-subtitle">{budgets.length} budget{budgets.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Add Budget</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Budgeted</div>
          <div className="stat-value accent">{formatCurrency(totalBudgeted)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Spent</div>
          <div className="stat-value negative">{formatCurrency(totalSpent)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Remaining</div>
          <div className={`stat-value ${remaining >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(remaining)}</div>
        </div>
      </div>

      {budgets.length > 0 ? (
        <div className="budget-list">
          {budgets.map(b => {
            const s = status(b)
            return (
              <div key={b.id} className="card budget-card">
                <div className="budget-row">
                  <div className="budget-cat">
                    <span className="color-dot" style={{ background: b.category_color }}></span>
                    <span className="budget-name">{b.category_name}</span>
                    <span className={`budget-status budget-status-${s.tone}`}>{s.label}</span>
                  </div>
                  <div className="budget-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(b)}><Pencil size={14} /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(b.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="budget-amounts">
                  <span className="budget-spent">{formatCurrency(b.spent)}</span>
                  <span className="budget-of"> of {formatCurrency(b.amount)}</span>
                  <span className="budget-period"> · {b.period}</span>
                </div>
                <div className="budget-bar-track">
                  <div
                    className={`budget-bar-fill budget-bar-${s.tone}`}
                    style={{ width: `${Math.min(s.pct, 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <h3>No budgets yet</h3>
            <p>Set spending limits per category to keep your finances on track</p>
            <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Add Budget</button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editing ? 'Edit Budget' : 'New Budget'}</h2>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={form.category_id}
                onChange={e => setForm({ ...form, category_id: e.target.value })}
                disabled={!!editing}
              >
                <option value="">Select a category</option>
                {availableCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Period</label>
                <select className="form-select" value={form.period} onChange={e => setForm({ ...form, period: e.target.value as BudgetPeriod })}>
                  {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!form.category_id || !form.amount}>{editing ? 'Save' : 'Add Budget'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
