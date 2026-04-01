import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { formatCurrency, formatDate, todayISO } from '../lib/format'
import type { Transaction, Account, Category, FamilyMember } from '../types'

export function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const [filters, setFilters] = useState({ type: '', account_id: '', category_id: '', family_member_id: '' })
  const [form, setForm] = useState({
    amount: '', type: 'expense', description: '', date: todayISO(),
    account_id: '', category_id: '', family_member_id: '', notes: ''
  })

  const load = async () => {
    const f: any = {}
    if (filters.type) f.type = filters.type
    if (filters.account_id) f.account_id = parseInt(filters.account_id)
    if (filters.category_id) f.category_id = parseInt(filters.category_id)
    if (filters.family_member_id) f.family_member_id = parseInt(filters.family_member_id)

    const result = await window.api.getTransactions(f)
    setTransactions(result.rows)
    setTotal(result.total)
  }

  const loadRefs = () => {
    window.api.getAccounts().then(setAccounts)
    window.api.getCategories().then(setCategories)
    window.api.getFamilyMembers().then(setMembers)
  }

  useEffect(loadRefs, [])
  useEffect(() => { load() }, [filters])

  const openNew = () => {
    setEditing(null)
    setForm({
      amount: '', type: 'expense', description: '', date: todayISO(),
      account_id: accounts.length > 0 ? String(accounts[0].id) : '',
      category_id: '', family_member_id: '', notes: ''
    })
    setShowModal(true)
  }

  const openEdit = (tx: Transaction) => {
    setEditing(tx)
    setForm({
      amount: String(tx.amount),
      type: tx.type,
      description: tx.description,
      date: tx.date,
      account_id: String(tx.account_id),
      category_id: tx.category_id ? String(tx.category_id) : '',
      family_member_id: tx.family_member_id ? String(tx.family_member_id) : '',
      notes: tx.notes || ''
    })
    setShowModal(true)
  }

  const save = async () => {
    const payload = {
      amount: parseFloat(form.amount) || 0,
      type: form.type,
      description: form.description,
      date: form.date,
      account_id: parseInt(form.account_id),
      category_id: form.category_id ? parseInt(form.category_id) : undefined,
      family_member_id: form.family_member_id ? parseInt(form.family_member_id) : undefined,
      notes: form.notes || undefined
    }

    if (editing) {
      await window.api.updateTransaction(editing.id, payload)
    } else {
      await window.api.addTransaction(payload)
    }
    setShowModal(false)
    load()
  }

  const remove = async (id: number) => {
    await window.api.deleteTransaction(id)
    load()
  }

  const filteredCategories = categories.filter(c =>
    form.type === 'transfer' ? false : c.type === form.type
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">{total} transaction{total !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={openNew} disabled={accounts.length === 0}>
          <Plus size={16} /> Add Transaction
        </button>
      </div>

      <div className="filters-row">
        <select className="form-select" value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
          <option value="">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="transfer">Transfer</option>
        </select>
        <select className="form-select" value={filters.account_id} onChange={e => setFilters({ ...filters, account_id: e.target.value })}>
          <option value="">All Accounts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="form-select" value={filters.category_id} onChange={e => setFilters({ ...filters, category_id: e.target.value })}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="form-select" value={filters.family_member_id} onChange={e => setFilters({ ...filters, family_member_id: e.target.value })}>
          <option value="">All Members</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div className="card">
        {transactions.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Member</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id}>
                    <td>
                      <div>{tx.description}</div>
                      {tx.category_name && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          <span className="color-dot" style={{ background: tx.category_color || '#666' }} />
                          {tx.category_name}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`amount ${tx.type === 'income' ? 'amount-positive' : tx.type === 'expense' ? 'amount-negative' : ''}`}>
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{formatCurrency(tx.amount)}
                      </span>
                    </td>
                    <td><span className={`tag tag-${tx.type}`}>{tx.type}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{formatDate(tx.date)}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{tx.account_name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{tx.family_member_name || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(tx)}><Pencil size={14} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => remove(tx.id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h3>No transactions found</h3>
            <p>{accounts.length === 0 ? 'Add an account first, then start tracking transactions' : 'Add your first transaction to start tracking'}</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editing ? 'Edit Transaction' : 'New Transaction'}</h2>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value, category_id: '' })}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" placeholder="What was this for?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Account</label>
                <select className="form-select" value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })}>
                  <option value="">Select account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">None</option>
                  {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Family Member</label>
                <select className="form-select" value={form.family_member_id} onChange={e => setForm({ ...form, family_member_id: e.target.value })}>
                  <option value="">None</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" placeholder="Optional notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!form.description || !form.amount || !form.account_id}>
                {editing ? 'Save' : 'Add Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
