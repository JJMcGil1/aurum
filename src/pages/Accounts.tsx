import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { formatCurrency } from '../lib/format'
import type { Account, FamilyMember } from '../types'

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'investment', label: 'Investment' },
  { value: 'cash', label: 'Cash' },
  { value: 'loan', label: 'Loan' },
]

export function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form, setForm] = useState({ name: '', type: 'checking', balance: '', currency: 'USD', institution: '', owner_id: '' })

  const load = () => {
    window.api.getAccounts().then(setAccounts)
    window.api.getFamilyMembers().then(setMembers)
  }

  useEffect(load, [])

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', type: 'checking', balance: '', currency: 'USD', institution: '', owner_id: '' })
    setShowModal(true)
  }

  const openEdit = (acc: Account) => {
    setEditing(acc)
    setForm({
      name: acc.name,
      type: acc.type,
      balance: String(acc.balance),
      currency: acc.currency,
      institution: acc.institution || '',
      owner_id: acc.owner_id ? String(acc.owner_id) : ''
    })
    setShowModal(true)
  }

  const save = async () => {
    const payload = {
      name: form.name,
      type: form.type,
      balance: parseFloat(form.balance) || 0,
      currency: form.currency,
      institution: form.institution || undefined,
      owner_id: form.owner_id ? parseInt(form.owner_id) : undefined
    }

    if (editing) {
      await window.api.updateAccount(editing.id, payload)
    } else {
      await window.api.addAccount(payload)
    }
    setShowModal(false)
    load()
  }

  const remove = async (id: number) => {
    if (confirm('Delete this account and all its transactions?')) {
      await window.api.deleteAccount(id)
      load()
    }
  }

  const totalBalance = accounts
    .filter(a => ['checking', 'savings', 'investment', 'cash'].includes(a.type))
    .reduce((s, a) => s + a.balance, 0)

  const totalDebt = accounts
    .filter(a => ['credit_card', 'loan'].includes(a.type))
    .reduce((s, a) => s + Math.abs(a.balance), 0)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounts</h1>
          <p className="page-subtitle">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Add Account</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Assets</div>
          <div className="stat-value positive">{formatCurrency(totalBalance)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Debt</div>
          <div className="stat-value negative">{formatCurrency(totalDebt)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Net</div>
          <div className={`stat-value ${totalBalance - totalDebt >= 0 ? 'accent' : 'negative'}`}>
            {formatCurrency(totalBalance - totalDebt)}
          </div>
        </div>
      </div>

      {accounts.length > 0 ? (
        <div className="accounts-grid">
          {accounts.map(acc => (
            <div key={acc.id} className="account-card">
              <div className="account-card-header">
                <div>
                  <div className="account-name">{acc.name}</div>
                  {acc.institution && <div className="account-institution">{acc.institution}</div>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(acc)}><Pencil size={14} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(acc.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="account-type">{acc.type.replace('_', ' ')}</div>
              <div className={`account-balance ${['credit_card', 'loan'].includes(acc.type) ? 'amount-negative' : 'amount-positive'}`} style={{ marginTop: 12 }}>
                {formatCurrency(acc.balance)}
              </div>
              {acc.owner_name && <div className="account-owner">Owner: {acc.owner_name}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <h3>No accounts yet</h3>
            <p>Add your first bank account, credit card, or investment to get started</p>
            <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Add Account</button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editing ? 'Edit Account' : 'New Account'}</h2>

            <div className="form-group">
              <label className="form-label">Account Name</label>
              <input className="form-input" placeholder="e.g. Chase Checking" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Balance</label>
                <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Institution</label>
                <input className="form-input" placeholder="e.g. Chase, Fidelity" value={form.institution} onChange={e => setForm({ ...form, institution: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Owner</label>
                <select className="form-select" value={form.owner_id} onChange={e => setForm({ ...form, owner_id: e.target.value })}>
                  <option value="">None</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!form.name}>{editing ? 'Save' : 'Add Account'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
