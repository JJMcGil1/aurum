type Props = {
  className?: string
  showMark?: boolean
}

export function AurumLogo({ className, showMark = true }: Props) {
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
