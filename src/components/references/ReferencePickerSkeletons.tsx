export function OptionSkeleton() {
  return (
    <div
      style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          background: 'var(--card-skeleton-from, #e3e4e8)',
          flexShrink: 0,
          animation: 'shimmer 1.5s ease-in-out infinite',
        }}
      />
      <div
        style={{
          height: 14,
          borderRadius: '3px',
          background: 'var(--card-skeleton-from, #e3e4e8)',
          flex: 1,
          maxWidth: 180,
          animation: 'shimmer 1.5s ease-in-out infinite',
          animationDelay: '0.1s',
        }}
      />
    </div>
  )
}

export function InitialSkeleton() {
  return (
    <div style={{padding: '8px'}}>
      <OptionSkeleton />
      <OptionSkeleton />
      <OptionSkeleton />
    </div>
  )
}
