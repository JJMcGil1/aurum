import { initials } from './format'

interface Props {
  name: string
  avatarImage?: string | null
  avatarColor?: string | null
  size?: 'sm' | 'md'
}

/**
 * Family-member avatar: real profile photo when one exists, otherwise a
 * tinted-initials disk using the member's saved avatar_color. Both shapes
 * are pixel-identical so they swap cleanly inside lists.
 */
export function MemberAvatar({ name, avatarImage, avatarColor, size = 'md' }: Props) {
  const dimension = size === 'sm' ? 24 : 30
  const radius = size === 'sm' ? 7 : 9
  const fontSize = size === 'sm' ? 10 : 11

  if (avatarImage) {
    return (
      <img
        src={`local-file://${avatarImage}`}
        alt={name}
        className={`tool-member-avatar tool-member-avatar-img${size === 'sm' ? ' tool-member-avatar-sm' : ''}`}
        style={{ width: dimension, height: dimension, borderRadius: radius }}
      />
    )
  }

  const tint = avatarColor || 'var(--accent)'
  return (
    <span
      className={`tool-member-avatar${size === 'sm' ? ' tool-member-avatar-sm' : ''}`}
      style={{
        width: dimension,
        height: dimension,
        borderRadius: radius,
        fontSize,
        background: `color-mix(in srgb, ${tint} 18%, transparent)`,
        color: tint,
      }}
    >
      {initials(name) || '?'}
    </span>
  )
}
