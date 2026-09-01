export function SkeletonStatTiles({ count = 4 }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="stat-tile animate-pulse">
          <div className="h-2.5 w-16 rounded bg-surface-2" />
          <div className="h-7 w-12 rounded bg-surface-2 mt-3" />
          <div className="h-1.5 w-full rounded-full bg-surface-2 mt-3" />
          <div className="h-3 w-24 rounded bg-surface-2 mt-2" />
        </div>
      ))}
    </>
  )
}

export function SkeletonCard({ lines = 4 }) {
  return (
    <div className="card p-5 animate-pulse">
      <div className="h-3 w-28 rounded bg-surface-2" />
      <div className="h-5 w-40 rounded bg-surface-2 mt-2" />
      <div className="flex flex-col gap-2 mt-5">
        {Array.from({ length: lines }, (_, index) => (
          <div key={index} className="h-4 rounded bg-surface-2" style={{ width: `${85 - index * 8}%` }} />
        ))}
      </div>
    </div>
  )
}

export function SkeletonChart({ height = 'h-56' }) {
  return (
    <div className="card chart-card p-5 animate-pulse">
      <div className="h-3 w-28 rounded bg-surface-2" />
      <div className="h-5 w-40 rounded bg-surface-2 mt-2" />
      <div className={`${height} rounded-lg bg-surface-2 mt-4`} />
    </div>
  )
}

export function SkeletonList({ rows = 6 }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="px-4 py-3 flex items-center justify-between gap-3 animate-pulse">
          <div className="flex-1">
            <div className="h-3.5 rounded bg-surface-2" style={{ width: `${55 - (index % 3) * 8}%` }} />
            <div className="h-3 rounded bg-surface-2 mt-2" style={{ width: `${35 + (index % 4) * 6}%` }} />
          </div>
          <div className="h-5 w-16 rounded bg-surface-2 flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonTableRows({ rows = 5, columns = 4 }) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-border animate-pulse">
          {Array.from({ length: columns }, (_, colIndex) => (
            <td key={colIndex} className="py-2.5 px-4">
              <div className="h-3.5 rounded bg-surface-2" style={{ width: colIndex === 0 ? '70%' : '50%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
