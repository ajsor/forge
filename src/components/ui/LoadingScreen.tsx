export default function LoadingScreen({ message }: { message?: string }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ background: '#0a0e16' }}
    >
      <div style={{ position: 'relative', width: 48, height: 48 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid rgba(96,165,250,0.15)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            borderTop: '2px solid #60a5fa',
            borderRight: '2px solid transparent',
            borderBottom: '2px solid transparent',
            borderLeft: '2px solid transparent',
            animation: 'radar-sweep 1.1s linear infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 8,
            height: 8,
            marginLeft: -4,
            marginTop: -4,
            borderRadius: '50%',
            background: '#f59e0b',
            animation: 'ember-pulse 1.6s ease-in-out infinite',
          }}
        />
      </div>
      <p style={{ color: '#5f6b7e', fontSize: 14, letterSpacing: '0.04em' }}>
        {message || 'Loading…'}
      </p>
    </div>
  )
}
