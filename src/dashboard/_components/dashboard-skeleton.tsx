/** The shape of a dashboard arriving, rather than a spinner in the middle of nothing. */
export function DashboardSkeleton() {
  return (
    <div className="mx-auto flex max-w-[110rem] flex-col gap-4 p-4 md:p-6">
      <div className="bg-surface-muted h-8 w-64 animate-pulse rounded" />
      <div className="bg-surface-muted h-16 w-full animate-pulse rounded-lg" />
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="bg-surface-muted h-28 animate-pulse rounded-lg" />
        ))}
      </div>
      <div className="bg-surface-muted h-64 w-full animate-pulse rounded-lg" />
    </div>
  )
}
