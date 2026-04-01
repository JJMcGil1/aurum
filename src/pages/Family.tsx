import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Camera, X } from 'lucide-react'
import { getInitials } from '../lib/format'
import type { FamilyMember } from '../types'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6']
const ROLES = ['Owner', 'Spouse', 'Partner', 'Child', 'Parent', 'Pet', 'Other']

interface FormState {
  first_name: string
  last_name: string
  role: string
  avatar_color: string
  avatar_image: string | null
}

const emptyForm: FormState = { first_name: '', last_name: '', role: 'Owner', avatar_color: COLORS[0], avatar_image: null }

export function Family() {
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<FamilyMember | null>(null)
  const [form, setForm] = useState<FormState>({ ...emptyForm })

  const load = () => { window.api.getFamilyMembers().then(setMembers) }
  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditing(null)
    setForm({ ...emptyForm })
    setShowModal(true)
  }

  const openEdit = (m: FamilyMember) => {
    setEditing(m)
    setForm({
      first_name: m.first_name,
      last_name: m.last_name,
      role: m.role,
      avatar_color: m.avatar_color,
      avatar_image: m.avatar_image
    })
    setShowModal(true)
  }

  const pickImage = async () => {
    const imagePath = await window.api.pickProfileImage()
    if (imagePath) {
      setForm({ ...form, avatar_image: imagePath })
    }
  }

  const removeImage = () => {
    setForm({ ...form, avatar_image: null })
  }

  const save = async () => {
    if (editing) {
      await window.api.updateFamilyMember(editing.id, form)
    } else {
      await window.api.addFamilyMember(form)
    }
    setShowModal(false)
    load()
  }

  const remove = async (id: number) => {
    if (confirm('Remove this family member?')) {
      await window.api.deleteFamilyMember(id)
      load()
    }
  }

  const renderAvatar = (m: FamilyMember | null, size: 'sm' | 'lg' | 'xl', formData?: FormState) => {
    const data = formData || (m ? { first_name: m.first_name, last_name: m.last_name, avatar_color: m.avatar_color, avatar_image: m.avatar_image } : null)
    if (!data) return null

    const sizeClass = size === 'xl' ? 'avatar-xl' : size === 'lg' ? 'avatar-lg' : ''
    const name = `${data.first_name} ${data.last_name}`.trim()

    if (data.avatar_image) {
      return (
        <div className={`avatar ${sizeClass}`} style={{ overflow: 'hidden', padding: 0 }}>
          <img
            src={`local-file://${data.avatar_image}`}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
          />
        </div>
      )
    }

    return (
      <div className={`avatar ${sizeClass}`} style={{ background: data.avatar_color }}>
        {name ? getInitials(name) : '?'}
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Family</h1>
          <p className="page-subtitle">Manage family members and pets to track individual spending</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Add Member</button>
      </div>

      {members.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {members.map(m => (
            <div key={m.id} className="member-card">
              {renderAvatar(m, 'lg')}
              <div className="member-info">
                <div className="member-name">{m.name}</div>
                <div className="member-role">{m.role}</div>
              </div>
              <div className="member-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}><Pencil size={14} /></button>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(m.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <h3>No family members yet</h3>
            <p>Add yourself, family members, and pets to track spending per member</p>
            <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Add Member</button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editing ? 'Edit Member' : 'Add Family Member'}</h2>

            {/* Avatar preview + image picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              {renderAvatar(null, 'xl', form)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={pickImage} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Camera size={14} /> {form.avatar_image ? 'Change Photo' : 'Add Photo'}
                </button>
                {form.avatar_image && (
                  <button className="btn btn-ghost btn-sm" onClick={removeImage} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                    <X size={14} /> Remove Photo
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">First Name</label>
                <input className="form-input" placeholder="First name" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Last Name</label>
                <input className="form-input" placeholder="Last name" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Color</label>
              <div className="color-picker">
                {COLORS.map(c => (
                  <div
                    key={c}
                    className={`color-swatch ${form.avatar_color === c ? 'selected' : ''}`}
                    style={{ background: c }}
                    onClick={() => setForm({ ...form, avatar_color: c })}
                  />
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!form.first_name}>{editing ? 'Save' : 'Add Member'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
