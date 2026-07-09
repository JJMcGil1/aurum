import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Repeat } from 'lucide-react'
import { formatCurrency, formatDate, getInitials, todayISO, recurrenceLabel, nextOccurrence } from '../lib/format'
import { ModalOverlay } from '../components/ModalOverlay'

import type { Expense, ExpenseRecurrence, FamilyMember } from '../types'

const RECURRENCE_OPTIONS: { value: ExpenseRecurrence; label: string }[] = [
  { value: 'once',      label: 'One-time' },
  { value: 'weekly',    label: 'Weekly' },
  { value: 'biweekly',  label: 'Every 2 weeks' },
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly',    label: 'Yearly' },
]

export function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [expenseDate, setExpenseDate] = useState<string>(todayISO())
  const [dueDate, setDueDate] = useState<string>('')
  const [recurrence, setRecurrence] = useState<ExpenseRecurrence>('once')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedBeneficiaries, setSelectedBeneficiaries] = useState<number[]>([])
  const [payerAmounts, setPayerAmounts] = useState<Record<number, string>>({})

  const load = () => {
    window.api.getExpenses().then(setExpenses)
    window.api.getFamilyMembers().then(setMembers)
  }

  const payerMembers = members.filter(m => m.role !== 'Pet')

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setName('')
    setAmount('')
    setNotes('')
    setExpenseDate(todayISO())
    setDueDate('')
    setRecurrence('once')
    setEndDate('')
    setSelectedBeneficiaries([])
    setPayerAmounts({})
    setEditing(null)
  }

  const openAdd = () => {
    resetForm()
    setShowModal(true)
  }

  const openEdit = (exp: Expense) => {
    setEditing(exp)
    setName(exp.name)
    setAmount(String(exp.amount))
    setNotes(exp.notes || '')
    setExpenseDate(exp.expense_date || todayISO())
    setDueDate(exp.due_date || '')
    setRecurrence(exp.recurrence || 'once')
    setEndDate(exp.end_date || '')
    setSelectedBeneficiaries(exp.beneficiaries.map(b => b.member_id))
    const pa: Record<number, string> = {}
    exp.payers.forEach(p => { pa[p.member_id] = String(p.amount || 0) })
    setPayerAmounts(pa)
    setShowModal(true)
  }

  const toggleBeneficiary = (id: number) => {
    setSelectedBeneficiaries(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const togglePayer = (id: number) => {
    setPayerAmounts(prev => {
      const next = { ...prev }
      if (id in next) {
        delete next[id]
      } else {
        next[id] = ''
      }
      return next
    })
  }

  const setPayerAmount = (id: number, val: string) => {
    setPayerAmounts(prev => ({ ...prev, [id]: val }))
  }

  const totalPaid = Object.values(payerAmounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)
  const totalAmount = parseFloat(amount) || 0

  const canSave = name.trim() && totalAmount > 0 && selectedBeneficiaries.length > 0 &&
    Object.keys(payerAmounts).length > 0 && Math.abs(totalPaid - totalAmount) < 0.01

  const handleSave = async () => {
    if (!canSave) return

    const payload = {
      name: name.trim(),
      amount: totalAmount,
      notes: notes.trim() || undefined,
      expense_date: expenseDate || null,
      due_date: dueDate || null,
      recurrence,
      end_date: recurrence === 'once' ? null : (endDate || null),
      beneficiary_ids: selectedBeneficiaries,
      payers: Object.entries(payerAmounts).map(([id, amt]) => ({
        member_id: Number(id),
        amount: parseFloat(amt) || 0,
      })),
    }

    if (editing) {
      await window.api.updateExpense(editing.id, payload)
    } else {
      await window.api.addExpense(payload)
    }

    setShowModal(false)
    resetForm()
    load()
  }

  const handleDelete = async (id: number) => {
    await window.api.deleteExpense(id)
    setConfirmDelete(null)
    load()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Expense</button>
      </div>

      {expenses.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>No expenses yet</h3>
            <p>Add your first expense to start tracking</p>
            <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Expense</button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Expense</th>
                  <th>Amount</th>
                  <th>Schedule</th>
                  <th>For</th>
                  <th>Paid By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => (
                  <tr key={exp.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{exp.name}</div>
                      {exp.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{exp.notes}</div>}
                    </td>
                    <td><span className="amount">{formatCurrency(exp.amount)}</span></td>
                    <td>
                      {(() => {
                        const isRecurring = exp.recurrence && exp.recurrence !== 'once'
                        const next = isRecurring
                          ? nextOccurrence(exp.expense_date, exp.recurrence, exp.end_date)
                          : (exp.due_date || exp.expense_date)
                        const today = new Date(); today.setHours(0, 0, 0, 0)
                        let color = 'var(--text-secondary)'
                        let suffix = ''
                        if (next) {
                          const nd = new Date(next + 'T00:00:00')
                          const diffDays = Math.round((nd.getTime() - today.getTime()) / 86400000)
                          if (diffDays < 0) { color = 'var(--red)'; suffix = ' · overdue' }
                          else if (diffDays <= 7) { color = '#f59e0b' }
                        }
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {isRecurring && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                                <Repeat size={11} />
                                <span>{recurrenceLabel(exp.recurrence)}</span>
                              </div>
                            )}
                            {next ? (
                              <div style={{ fontSize: 13, color }}>
                                {isRecurring ? 'Next ' : ''}{formatDate(next)}{suffix}
                              </div>
                            ) : (
                              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                {isRecurring && exp.end_date ? 'Ended' : '—'}
                              </div>
                            )}
                            {!isRecurring && exp.expense_date && exp.due_date && exp.due_date !== exp.expense_date && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Charged {formatDate(exp.expense_date)}
                              </div>
                            )}
                            {isRecurring && exp.end_date && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Until {formatDate(exp.end_date)}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {exp.beneficiaries.map(b => (
                          b.avatar_image ? (
                            <img
                              key={b.member_id}
                              src={`local-file://${b.avatar_image}`}
                              alt={b.member_name}
                              title={b.member_name}
                              style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              key={b.member_id}
                              className="avatar"
                              style={{ background: b.avatar_color, width: 26, height: 26, fontSize: 10 }}
                              title={b.member_name}
                            >
                              {getInitials(b.member_name)}
                            </div>
                          )
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {exp.payers.map(p => (
                          <div key={p.member_id} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {p.avatar_image ? (
                              <img
                                src={`local-file://${p.avatar_image}`}
                                alt={p.member_name}
                                title={p.member_name}
                                style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
                              />
                            ) : (
                              <div
                                className="avatar"
                                style={{ background: p.avatar_color, width: 22, height: 22, fontSize: 9 }}
                                title={p.member_name}
                              >
                                {getInitials(p.member_name)}
                              </div>
                            )}
                            <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(p.amount || 0)}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="member-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(exp)}><Pencil size={14} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(exp.id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <ModalOverlay open={showModal} onClose={() => { setShowModal(false); resetForm() }}>
        <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editing ? 'Edit Expense' : 'Add Expense'}</h2>

            <div className="form-group">
              <label className="form-label">Expense Name</label>
              <input className="form-input" placeholder="e.g. Rent, Groceries, Electric Bill" value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Amount</label>
              <input className="form-input" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{recurrence === 'once' ? 'Expense Date' : 'Start Date'}</label>
                <input
                  className="form-input"
                  type="date"
                  value={expenseDate}
                  onChange={e => setExpenseDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{recurrence === 'once' ? 'Due Date (optional)' : 'First Due Date (optional)'}</label>
                <input
                  className="form-input"
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  min={expenseDate || undefined}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Recurrence</label>
                <select
                  className="form-input"
                  value={recurrence}
                  onChange={e => setRecurrence(e.target.value as ExpenseRecurrence)}
                >
                  {RECURRENCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {recurrence !== 'once' && (
                <div className="form-group">
                  <label className="form-label">End Date (optional)</label>
                  <input
                    className="form-input"
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    min={expenseDate || undefined}
                    placeholder="No end"
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input className="form-input" placeholder="Any additional details..." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            {members.length === 0 ? (
              <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                Add family members first to assign expenses.
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Who is this expense for?</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {members.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        className={`btn btn-sm ${selectedBeneficiaries.includes(m.id) ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => toggleBeneficiary(m.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        {m.avatar_image ? (
                          <img src={`local-file://${m.avatar_image}`} alt={m.name} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div className="avatar" style={{ background: m.avatar_color, width: 20, height: 20, fontSize: 9 }}>
                            {getInitials(m.name)}
                          </div>
                        )}
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Who pays?</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    {payerMembers.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        className={`btn btn-sm ${m.id in payerAmounts ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => togglePayer(m.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        {m.avatar_image ? (
                          <img src={`local-file://${m.avatar_image}`} alt={m.name} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div className="avatar" style={{ background: m.avatar_color, width: 20, height: 20, fontSize: 9 }}>
                            {getInitials(m.name)}
                          </div>
                        )}
                        {m.name}
                      </button>
                    ))}
                  </div>

                  {Object.keys(payerAmounts).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Object.entries(payerAmounts).map(([idStr, amt]) => {
                        const id = Number(idStr)
                        const member = members.find(m => m.id === id)
                        if (!member) return null
                        return (
                          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                              {member.avatar_image ? (
                                <img src={`local-file://${member.avatar_image}`} alt={member.name} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <div className="avatar" style={{ background: member.avatar_color, width: 24, height: 24, fontSize: 10 }}>
                                  {getInitials(member.name)}
                                </div>
                              )}
                              <span style={{ fontSize: 14, fontWeight: 500 }}>{member.name}</span>
                            </div>
                            <input
                              className="form-input"
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={amt}
                              onChange={e => setPayerAmount(id, e.target.value)}
                              style={{ width: 140 }}
                            />
                          </div>
                        )
                      })}
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Total paid: </span>
                        <span style={{ fontWeight: 600, color: Math.abs(totalPaid - totalAmount) < 0.01 ? 'var(--green)' : 'var(--red)' }}>
                          {formatCurrency(totalPaid)}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}> / {formatCurrency(totalAmount)}</span>
                        {Math.abs(totalPaid - totalAmount) >= 0.01 && totalAmount > 0 && (
                          <span style={{ color: 'var(--red)', marginLeft: 8, fontSize: 12 }}>
                            ({totalPaid > totalAmount ? '+' : ''}{formatCurrency(totalPaid - totalAmount)} difference)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm() }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!canSave}>
                {editing ? 'Save Changes' : 'Add Expense'}
              </button>
            </div>
        </div>
      </ModalOverlay>

      {/* Delete confirmation */}
      <ModalOverlay open={confirmDelete !== null} onClose={() => setConfirmDelete(null)}>
        <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
          <h2 className="modal-title">Delete Expense</h2>
          <p className="confirm-text">Are you sure you want to delete this expense? This cannot be undone.</p>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => confirmDelete !== null && handleDelete(confirmDelete)}>Delete</button>
          </div>
        </div>
      </ModalOverlay>
    </div>
  )
}
