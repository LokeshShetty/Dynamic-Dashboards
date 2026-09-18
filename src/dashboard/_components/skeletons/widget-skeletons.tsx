/* oxlint-disable react/no-array-index-key -- these lists are rebuilt from immutable
   render input on every pass and are never reordered, so the index is the stable identity. */
/**
 * Skeletons take the shape of the widget that is coming, so the layout does not jump and the
 * reader can tell a loading table from a loading chart. There is no generic spinner anywhere
 * in this app.
 */
const BAR = 'bg-surface-muted animate-pulse rounded'

export function MetricSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className={`${BAR} h-8 w-28`} />
      <div className={`${BAR} h-3 w-20`} />
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`${BAR} h-4 w-full`} />
      {Array.from({ length: rows }, (_unused, index) => (
        <div key={index} className={`${BAR} h-3 w-full`} />
      ))}
    </div>
  )
}

export function ChartSkeleton() {
  const heights = ['h-10', 'h-16', 'h-8', 'h-20', 'h-12', 'h-24', 'h-14']

  return (
    <div className="flex h-full min-h-32 flex-col justify-end gap-2">
      <div className="flex items-end gap-2">
        {heights.map((height, index) => (
          <div key={index} className={`${BAR} ${height} flex-1`} />
        ))}
      </div>
      <div className={`${BAR} h-1 w-full`} />
    </div>
  )
}

export function TextSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className={`${BAR} h-3 w-full`} />
      <div className={`${BAR} h-3 w-11/12`} />
      <div className={`${BAR} h-3 w-2/3`} />
    </div>
  )
}
