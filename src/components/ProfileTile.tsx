import { useEffect, useMemo, useState } from 'react'
import { UserPlus, Camera, X } from 'lucide-react'
import { getInitials } from '../lib/format'
import type { FamilyMember } from '../types'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6']

interface FormState {
  first_name: string
  last_name: string
  email: string
  avatar_color: string
  avatar_image: string | null
}

const emptyForm: FormState = {
  first_name: '',
  last_name: '',
  email: '',
  avatar_color: COLORS[0],
  avatar_image: null,
}

function pickProfile(members: FamilyMember[]): FamilyMember | null {
  if (members.length === 0) return null
  return members.find(m => m.role === 'Owner') ?? members[0]
}

export function ProfileTile() {
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>({ ...emptyForm })

  const profile = useMemo(() => pickProfile(members), [members])

  const load = () => { window.api.getFamilyMembers().then(setMembers) }
  useEffect(() => { load() }, [])

  const openModal = () => {
    if (profile) {
      setForm({
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email ?? '',
        avatar_color: profile.avatar_color,
        avatar_image: profile.avatar_image,
      })
    } else {
      setForm({ ...emptyForm })
    }
    setShowModal(true)
  }

  const pickImage = async () => {
    const imagePath = await window.api.pickProfileImage()
    if (imagePath) setForm(f => ({ ...f, avatar_image: imagePath }))
  }

  const removeImage = () => setForm(f => ({ ...f, avatar_image: null }))

  const save = async () => {
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      avatar_color: form.avatar_color,
      avatar_image: form.avatar_image,
    }
    if (profile) {
      await window.api.updateFamilyMember(profile.id, payload)
    } else {
      await window.api.addFamilyMember({ ...payload, role: 'Owner' } as any)
    }
    setShowModal(false)
    load()
  }

  const fullName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : ''
  const formFullName = `${form.first_name} ${form.last_name}`.trim()

  const renderAvatar = (size: 'sm' | 'xl', data: { first_name: string; last_name: string; avatar_color: string; avatar_image: string | null }) => {
    const sizeClass = size === 'xl' ? 'avatar-xl' : ''
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
    <>
      <button
        type="button"
        className="rail-link rail-profile"
        onClick={openModal}
        title={profile ? fullName || 'Profile' : 'Set up profile'}
        aria-label={profile ? `Profile: ${fullName}` : 'Set up profile'}
      >
        {profile ? (
          renderAvatar('sm', profile)
        ) : (
          <UserPlus />
        )}
        <span className="rail-label">{profile ? fullName || 'Profile' : 'Set up profile'}</span>
      </button>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{profile ? 'Edit Profile' : 'Create Profile'}</h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              {renderAvatar('xl', { first_name: form.first_name || (formFullName || '?'), last_name: form.last_name, avatar_color: form.avatar_color, avatar_image: form.avatar_image })}
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
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
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

            {profile && (
              <p className="settings-help" style={{ marginTop: 4 }}>
                Linked to your family member <strong>{fullName || 'Owner'}</strong> ({profile.role}).
              </p>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!form.first_name.trim()}>
                {profile ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
