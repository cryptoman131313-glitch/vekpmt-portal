// Простой шиммер-скелетон. Используется когда нет ни кэша, ни данных
// (только при самом первом заходе). После этого всегда показывается
// последняя версия из localStorage.

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: boolean
}

export function Skeleton({ className = '', width, height = 14, rounded = false }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: width ?? '100%',
        height,
        borderRadius: rounded ? 999 : 6,
        background: 'linear-gradient(90deg, #F4F4F5 0%, #E4E4E7 50%, #F4F4F5 100%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
        display: 'block',
      }}
    />
  )
}

// Несколько строк-скелетонов для списков/таблиц
export function SkeletonRows({ count = 5, height = 44 }: { count?: number; height?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={height} />
      ))}
    </div>
  )
}

// Карточка с парой строк — для деталей
export function SkeletonCard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
      <Skeleton width="40%" height={20} />
      <Skeleton width="100%" height={14} />
      <Skeleton width="80%" height={14} />
      <Skeleton width="60%" height={14} />
    </div>
  )
}
