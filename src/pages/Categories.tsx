import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Category } from '../types'

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#64748b', '#78716c', '#a855f7', '#10b981']

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'expense' as 'income' | 'expense', color: COLORS[0] })

  const load = () => { window.api.getCategories().then(setCategories) }
  useEffect(() => { load() }, [])

  const save = async () => {
    await window.api.addCategory(form)
    setShowModal(false)
    setForm({ name: '', type: 'expense', color: COLORS[0] })
    load()
  }

  const remove = async (id: number) => {
    await window.api.deleteCategory(id)
    load()
  }

  const incomeCategories = categories.filter(c => c.type === 'income')
  const expenseCategories = categories.filter(c => c.type === 'expense')

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Categories</h1>
          <p className="page-subtitle">Organize your transactions</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Add Category</button>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Income Categories</h3>
        </div>
        {incomeCategories.length > 0 ? (
          <div className="category-grid">
            {incomeCategories.map(c => (
              <div key={c.id} className="category-item">
                <div className="category-info">
                  <span className="color-dot" style={{ background: c.color, width: 12, height: 12 }} />
                  <span>{c.name}</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(c.id)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state"><p>No income categories</p></div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Expense Categories</h3>
        </div>
        {expenseCategories.length > 0 ? (
          <div className="category-grid">
            {expenseCategories.map(c => (
              <div key={c.id} className="category-item">
                <div className="category-info">
                  <span className="color-dot" style={{ background: c.color, width: 12, height: 12 }} />
                  <span>{c.name}</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(c.id)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state"><p>No expense categories</p></div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">New Category</h2>

            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" placeholder="Category name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'income' | 'expense' })}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Color</label>
              <div className="color-picker">
                {COLORS.map(c => (
                  <div
                    key={c}
                    className={`color-swatch ${form.color === c ? 'selected' : ''}`}
                    style={{ background: c }}
                    onClick={() => setForm({ ...form, color: c })}
                  />
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!form.name}>Add Category</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
