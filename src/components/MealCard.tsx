import type { MealEntry } from '@/types'
import { mealTypeLabel, useI18n } from '@/hooks/useI18n'

interface MealCardProps {
  meal: MealEntry
  onDelete?: (id: string) => void
}

export function MealCard({ meal, onDelete }: MealCardProps) {
  const { t, locale } = useI18n()
  const time = new Date(meal.createdAt).toLocaleTimeString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <article className="group glass-card overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:shadow-glass-lift dark:hover:shadow-[0_12px_36px_rgba(0,0,0,0.35)]">
      <div className="flex gap-0 sm:gap-0">
        <div className="relative h-[5.5rem] w-[5.5rem] shrink-0 overflow-hidden sm:h-28 sm:w-28">
          {meal.imageDataUrl ? (
            <img src={meal.imageDataUrl} alt={meal.food} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-green to-emerald-700 font-display text-3xl font-bold text-white">
              {meal.food.slice(0, 1)}
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between p-3 sm:p-4">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-muted dark:bg-white/10 dark:text-white/60">
                {mealTypeLabel(locale, meal.mealType)}
              </span>
              <span className="tabular text-xs text-brand-muted dark:text-white/45">{time}</span>
            </div>
            <h3 className="truncate font-display text-[15px] font-semibold text-brand-ink dark:text-white sm:text-base">
              {meal.food}
            </h3>
          </div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              <span className="rounded-md bg-brand-blue-soft px-1.5 py-0.5 text-[10px] font-bold text-brand-blue dark:bg-brand-blue/20">
                P {Math.round(meal.protein)}
              </span>
              <span className="rounded-md bg-brand-orange-soft px-1.5 py-0.5 text-[10px] font-bold text-brand-orange dark:bg-brand-orange/20">
                C {Math.round(meal.carbs)}
              </span>
              <span className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-bold text-brand-ink dark:bg-white/10 dark:text-white/70">
                F {Math.round(meal.fat)}
              </span>
            </div>
            <p className="tabular font-display text-xl font-bold tracking-tight text-brand-ink dark:text-white">
              {meal.calories}
              <span className="ml-0.5 text-[10px] font-semibold text-brand-muted">kcal</span>
            </p>
          </div>
        </div>

        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(meal.id)}
            className="self-stretch border-l border-black/[0.04] px-3 text-xs font-semibold text-brand-muted opacity-70 transition hover:bg-red-50 hover:text-red-600 hover:opacity-100 dark:border-white/10 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            aria-label={t.meal.delete}
          >
            ✕
          </button>
        )}
      </div>
    </article>
  )
}
