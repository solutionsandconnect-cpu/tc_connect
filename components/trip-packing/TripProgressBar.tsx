'use client'

export default function TripProgressBar({ done, total, pct }: { done: number; total: number; pct: number }) {
  const complete = total > 0 && done === total
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-500">
          {done} / {total} validé{done > 1 ? 's' : ''}
        </span>
        <span className={`text-xs font-bold ${complete ? 'text-green-600' : 'text-blue-600'}`}>{pct}%</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${complete ? 'bg-green-500' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
