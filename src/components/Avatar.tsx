import { getInitials } from '../lib/format'

interface AvatarProps {
  name: string
  avatarColor: string
  avatarImage?: string | null
  size?: number
  fontSize?: number
}

export function Avatar({ name, avatarColor, avatarImage, size = 26, fontSize = 10 }: AvatarProps) {
  if (avatarImage) {
    return (
      <img
        src={`local-file://${avatarImage}`}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      />
    )
  }

  return (
    <div
      className="avatar"
      style={{ background: avatarColor, width: size, height: size, fontSize }}
      title={name}
    >
      {getInitials(name)}
    </div>
  )
}
