interface ScoreGaugeProps {
  score: number
  label: string
  outOfLabel: string
  bandLabel: string
  hint?: string
  size?: number
}

function scoreAccent(score: number): string {
  if (score >= 85) return '#22A06B'
  if (score >= 70) return '#3DCF8A'
  if (score >= 40) return '#E88B2E'
  return '#E05A4C'
}

/** Circular gauge: makes “n out of 100” obvious at a glance. */
export function ScoreGauge({ score, label, outOfLabel, bandLabel, hint, size = 132 }: ScoreGaugeProps) {
  const value = Math.min(100, Math.max(0, Math.round(score)))
  const accent = scoreAccent(value)
  const soft =
    value >= 70 ? 'rgba(34, 160, 107, 0.16)' : value >= 40 ? 'rgba(232, 139, 46, 0.18)' : 'rgba(224, 90, 76, 0.16)'
  const r = size * 0.36
  const c = 2 * Math.PI * r
  const offset = c - (value / 100) * c
  const stroke = size >= 140 ? 12 : 10

  return (
    <div className="flex items-center gap-4 sm:gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
        <svg className="h-full w-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={soft} strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular font-display text-3xl font-bold leading-none tracking-tight text-brand-ink dark:text-white sm:text-4xl">
            {value}
          </span>
          <span className="mt-0.5 text-[11px] font-semibold text-brand-muted dark:text-white/50">/ 100</span>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-nowrap-keep text-sm font-medium text-brand-muted dark:text-white/50">{label}</p>
        <p className="tabular font-display text-2xl font-bold leading-tight text-brand-ink text-balance-ko dark:text-white sm:text-3xl">
          {outOfLabel}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: accent }}
          >
            {bandLabel}
          </span>
        </div>
        <div className="h-2 max-w-[14rem] overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${value}%`, backgroundColor: accent }}
          />
        </div>
        {hint && (
          <p className="text-xs leading-relaxed text-brand-muted text-balance-ko dark:text-white/50">{hint}</p>
        )}
      </div>
    </div>
  )
}

export function scoreBandKey(score: number): 'low' | 'mid' | 'good' | 'great' {
  const v = Math.min(100, Math.max(0, Math.round(score)))
  if (v >= 85) return 'great'
  if (v >= 70) return 'good'
  if (v >= 40) return 'mid'
  return 'low'
}
