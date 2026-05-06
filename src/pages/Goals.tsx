import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, Target } from 'lucide-react'
import { formatCurrency } from '../lib/format'
import type { Goal } from '../types'

const COLORS = ['#d4a843', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#14b8a6', '#ef4444']

export function Goals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [form, setForm] = useState({ name: '', target_amount: '', current_amount: '', target_date: '', color: '#d4a843', notes: '' })
  const [contributing, setContributing] = useState<Goal | null>(null)
  const [contribution, setContribution] = useState('')

  const load = () => { window.api.getGoals().then(setGoals) }
  useEffect(load, [])

  const totalTargets = goals.reduce((s, g) => s + g.target_amount, 0)
  const totalCurrent = goals.reduce((s, g) => s + g.current_amount, 0)

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', target_amount: '', current_amount: '', target_date: '', color: '#d4a843', notes: '' })
    setShowModal(true)
  }

  const openEdit = (g: Goal) => {
    setEditing(g)
    setForm({
      name: g.name,
      target_amount: String(g.target_amount),
      current_amount: String(g.current_amount),
      target_date: g.target_date || '',
      color: g.color,
      notes: g.notes || '',
    })
    setShowModal(true)
  }

  const save = async () => {
    const payload = {
      name: form.name,
      target_amount: parseFloat(form.target_amount) || 0,
      current_amount: parseFloat(form.current_amount) || 0,
      target_date: form.target_date || null,
      color: form.color,
      notes: form.notes || null,
    }
    if (editing) await window.api.updateGoal(editing.id, payload)
    else await window.api.addGoal(payload)
    setShowModal(false)
    load()
  }

  const remove = async (id: number) => {
    if (confirm('Delete this goal?')) {
      await window.api.deleteGoal(id)
      load()
    }
  }

  const submitContribution = async () => {
    if (!contributing) return
    const amt = parseFloat(contribution) || 0
    if (amt <= 0) return
    await window.api.contributeToGoal(contributing.id, amt)
    setContributing(null)
    setContribution('')
    load()
  }

  const daysUntil = (date: string | null) => {
    if (!date) return null
    const d = new Date(date + 'T00:00:00')
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Goals</h1>
          <p className="page-subtitle">{goals.length} goal{goals.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Add Goal</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Target</div>
          <div className="stat-value accent">{formatCurrency(totalTargets)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Saved</div>
          <div className="stat-value positive">{formatCurrency(totalCurrent)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">To Go</div>
          <div className="stat-value">{formatCurrency(Math.max(totalTargets - totalCurrent, 0))}</div>
        </div>
      </div>

      {goals.length > 0 ? (
        <div className="goals-grid">
          {goals.map(g => {
            const pct = g.target_amount > 0 ? Math.min((g.current_amount / g.target_amount) * 100, 100) : 0
            const remaining = Math.max(g.target_amount - g.current_amount, 0)
            const days = daysUntil(g.target_date)
            const complete = g.current_amount >= g.target_amount
            return (
              <div key={g.id} className="card goal-card">
                <div className="goal-card-header">
                  <div className="goal-icon" style={{ background: g.color + '22', color: g.color }}><Target size={18} /></div>
                  <div className="goal-card-title">
                    <div className="goal-name">{g.name}</div>
                    {g.target_date && (
                      <div className="goal-date">
                        {new Date(g.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {days !== null && days >= 0 && <> · {days} day{days !== 1 ? 's' : ''} left</>}
                        {days !== null && days < 0 && <> · overdue</>}
                      </div>
                    )}
                  </div>
                  <div className="goal-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(g)}><Pencil size={14} /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(g.id)}><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="goal-amounts">
                  <span className="goal-current">{formatCurrency(g.current_amount)}</span>
                  <span className="goal-of"> of {formatCurrency(g.target_amount)}</span>
                </div>

                <div className="goal-bar-track">
                  <div className="goal-bar-fill" style={{ width: `${pct}%`, background: g.color }} />
                </div>

                <div className="goal-card-footer">
                  <span className="goal-pct">{pct.toFixed(0)}%</span>
                  <span className="goal-remaining">{complete ? 'Goal reached' : `${formatCurrency(remaining)} to go`}</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setContributing(g); setContribution('') }}>+ Contribute</button>
                </div>

                {g.notes && <p className="goal-notes">{g.notes}</p>}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <h3>No goals yet</h3>
            <p>Set savings goals to track progress on what matters</p>
            <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Add Goal</button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editing ? 'Edit Goal' : 'New Goal'}</h2>

            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" placeholder="e.g. Emergency Fund, Vacation" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Target Amount</label>
                <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.target_amount} onChange={e => setForm({ ...form, target_amount: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Saved So Far</label>
                <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.current_amount} onChange={e => setForm({ ...form, current_amount: e.target.value })} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Target Date (optional)</label>
              <input className="form-input" type="date" value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">Color</label>
              <div className="color-picker">
                {COLORS.map(c => (
                  <div key={c} className={`color-swatch ${form.color === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} />
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" placeholder="Optional" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!form.name || !form.target_amount}>{editing ? 'Save' : 'Add Goal'}</button>
            </div>
          </div>
        </div>
      )}

      {contributing && (
        <div className="modal-overlay" onClick={() => setContributing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Contribute to {contributing.name}</h2>
            <div className="form-group">
              <label className="form-label">Amount</label>
              <input className="form-input" type="number" step="0.01" placeholder="0.00" autoFocus value={contribution} onChange={e => setContribution(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setContributing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitContribution} disabled={!contribution}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
