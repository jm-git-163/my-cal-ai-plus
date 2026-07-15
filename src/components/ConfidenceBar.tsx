interface ConfidenceBarProps {
  label: string
  value: number
}

export function ConfidenceBar({ label, value }: ConfidenceBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  const tone =
    pct >= 75 ? 'bg-brand-green' : pct >= 50 ? 'bg-brand-orange' : 'bg-red-400'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-brand-muted dark:text-white/55">{label}</span>
        <span className="font-semibold tabular-nums text-brand-ink dark:text-white">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
