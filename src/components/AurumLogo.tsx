type Props = {
  className?: string
  showMark?: boolean
  iconOnly?: boolean
}

export function AurumLogo({ className, showMark = true, iconOnly = false }: Props) {
  if (iconOnly) {
    return (
      <svg
        className={className}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Aurum"
        role="img"
      >
        <defs>
          <linearGradient id="aurum-bar-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EABD42" />
            <stop offset="100%" stopColor="#A07D20" />
          </linearGradient>
          <linearGradient id="aurum-bar-top" x1="0" y1="0" x2="1" y2="0.6">
            <stop offset="0%" stopColor="#FFF1A6" />
            <stop offset="60%" stopColor="#F0CE52" />
            <stop offset="100%" stopColor="#C49A30" />
          </linearGradient>
          <linearGradient id="aurum-bar-side" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#9C7A1E" />
            <stop offset="100%" stopColor="#4A3508" />
          </linearGradient>
        </defs>

        {/* Bar 4 (bottom) — staggered right */}
        <g transform="translate(34, 48)">
          <path d="M-18,0 L18,0 L18,8 L-18,8 Z" fill="url(#aurum-bar-front)" />
          <path d="M-18,0 L-13,-5 L13,-5 L18,0 Z" fill="url(#aurum-bar-top)" />
          <path d="M18,0 L13,-5 L13,3 L18,8 Z" fill="url(#aurum-bar-side)" />
        </g>

        {/* Bar 3 — staggered left */}
        <g transform="translate(30, 37)">
          <path d="M-18,0 L18,0 L18,8 L-18,8 Z" fill="url(#aurum-bar-front)" />
          <path d="M-18,0 L-13,-5 L13,-5 L18,0 Z" fill="url(#aurum-bar-top)" />
          <path d="M18,0 L13,-5 L13,3 L18,8 Z" fill="url(#aurum-bar-side)" />
        </g>

        {/* Bar 2 — staggered right */}
        <g transform="translate(34, 26)">
          <path d="M-18,0 L18,0 L18,8 L-18,8 Z" fill="url(#aurum-bar-front)" />
          <path d="M-18,0 L-13,-5 L13,-5 L18,0 Z" fill="url(#aurum-bar-top)" />
          <path d="M18,0 L13,-5 L13,3 L18,8 Z" fill="url(#aurum-bar-side)" />
        </g>

        {/* Bar 1 (top, hero) — staggered left, slightly brighter top */}
        <g transform="translate(30, 15)">
          <path d="M-18,0 L18,0 L18,8 L-18,8 Z" fill="url(#aurum-bar-front)" />
          <path d="M-18,0 L-13,-5 L13,-5 L18,0 Z" fill="url(#aurum-bar-top)" />
          <path d="M18,0 L13,-5 L13,3 L18,8 Z" fill="url(#aurum-bar-side)" />
          <line x1="-18" y1="0" x2="18" y2="0" stroke="#FFF8B0" strokeWidth="0.5" opacity="0.7" />
        </g>
      </svg>
    )
  }

  return (
    <svg
      className={className}
      viewBox="0 0 240 56"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Aurum"
      role="img"
      style={{ color: 'var(--text-primary)' }}
    >
      {showMark && (
        <g>
          <circle
            cx="22"
            cy="28"
            r="13"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.55"
            strokeWidth="1.25"
          />
          <text
            x="22"
            y="34"
            textAnchor="middle"
            fontFamily="'Instrument Serif', 'Iowan Old Style', Georgia, serif"
            fontStyle="italic"
            fontWeight="400"
            fontSize="18"
            fill="currentColor"
            fillOpacity="0.92"
          >
            A
          </text>
        </g>
      )}

      <text
        x={showMark ? 46 : 4}
        y="40"
        fontFamily="'Instrument Serif', 'Iowan Old Style', Georgia, serif"
        fontStyle="italic"
        fontWeight="400"
        fontSize="34"
        letterSpacing="0.5"
        fill="currentColor"
      >
        Aurum
      </text>
    </svg>
  )
}
