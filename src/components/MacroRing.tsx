interface MacroRingProps {
  label: string
  value: number
  goal: number
  unit: string
  accent: string
  soft: string
  large?: boolean
}

export function MacroRing({ label, value, goal, unit, accent, soft, large }: MacroRingProps) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  const size = large ? 132 : 96
  const r = large ? 48 : 36
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  const stroke = large ? 10 : 8

  return (
    <div className={`glass-card flex flex-col items-center gap-2 ${large ? 'p-5 sm:p-6' : 'p-3.5 sm:p-4'}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="h-full w-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={soft}
            strokeWidth={stroke}
          />
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
          <span
            className={`tabular font-display font-bold tracking-tight text-brand-ink dark:text-white ${
              large ? 'text-3xl sm:text-4xl' : 'text-lg'
            }`}
          >
            {Math.round(value)}
          </span>
          <span className="text-[10px] font-medium text-brand-muted dark:text-white/45">{unit}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-brand-ink dark:text-white">{label}</p>
        <p className="tabular text-xs text-brand-muted dark:text-white/45">
          / {goal}
          {unit}
        </p>
      </div>
    </div>
  )
}
