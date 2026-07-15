import type { MealEntry } from '@/types'
import { mealTypeLabel, useI18n } from '@/hooks/useI18n'
import { formatConfidence } from '@/utils/nutrition'

const mealColors: Record<string, string> = {
  Breakfast: 'bg-brand-orange-soft text-brand-orange dark:bg-brand-orange/20',
  Lunch: 'bg-brand-green-soft text-brand-green dark:bg-brand-green/20',
  Dinner: 'bg-brand-blue-soft text-brand-blue dark:bg-brand-blue/20',
  Snack: 'bg-brand-soft text-brand-muted dark:bg-white/10 dark:text-white/70',
}

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
    <article className="glass-card flex gap-4 p-4">
      {meal.imageDataUrl ? (
        <img
          src={meal.imageDataUrl}
          alt={meal.food}
          className="h-20 w-20 shrink-0 rounded-2xl object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-brand-green-soft font-display text-2xl font-bold text-brand-green dark:bg-brand-green/20">
          {meal.food.slice(0, 1)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${mealColors[meal.mealType]}`}>
            {mealTypeLabel(locale, meal.mealType)}
          </span>
          <span className="text-xs text-brand-muted dark:text-white/50">{time}</span>
          <span className="text-xs text-brand-muted dark:text-white/50">
            · {formatConfidence(meal.confidence)}
          </span>
        </div>
        <h3 className="truncate font-display text-base font-semibold text-brand-ink dark:text-white">
          {meal.food}
        </h3>
        <p className="mt-1 text-sm text-brand-muted dark:text-white/55">
          {meal.calories} kcal · P {meal.protein}g · C {meal.carbs}g · F {meal.fat}g · {meal.grams}g
        </p>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(meal.id)}
          className="self-start rounded-xl px-2 py-1 text-xs font-medium text-brand-muted hover:bg-red-50 hover:text-red-600 dark:text-white/50 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          aria-label={t.meal.delete}
        >
          {t.meal.delete}
        </button>
      )}
    </article>
  )
}
