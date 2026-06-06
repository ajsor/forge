export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Anvil */}
      <path d="M10 30 L54 30 L48 38 L16 38 Z" fill="#60a5fa" />
      <rect x="22" y="38" width="20" height="6" fill="#60a5fa" />
      <rect x="18" y="44" width="28" height="6" fill="#3b82f6" />
      {/* Ember spark */}
      <circle cx="50" cy="18" r="5" fill="#f59e0b" />
      <circle cx="50" cy="18" r="2.2" fill="#fbbf24" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span
      style={{
        fontFamily: 'Sora, sans-serif',
        fontSize: 21,
        fontWeight: 700,
        letterSpacing: '-0.03em',
        color: '#e6ebf2',
      }}
    >
      Forge
    </span>
  )
}
