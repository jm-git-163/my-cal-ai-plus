interface MacroRingProps {
  label: string
  value: number
  goal: number
  unit: string
  accent: string
  soft: string
}

export function MacroRing({ label, value, goal, unit, accent, soft }: MacroRingProps) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  const r = 36
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c

  return (
    <div className="glass-card flex flex-col items-center gap-3 p-5">
      <div className="relative h-24 w-24">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={r} fill="none" stroke={soft} strokeWidth="8" />
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke={accent}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-lg font-bold text-brand-ink dark:text-white">
            {Math.round(value)}
          </span>
          <span className="text-[10px] text-brand-muted dark:text-white/50">{unit}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-brand-ink dark:text-white">{label}</p>
        <p className="text-xs text-brand-muted dark:text-white/50">
          {goal}
          {unit}
        </p>
      </div>
    </div>
  )
}
