import { MealCard } from '@/components/MealCard'
import { useI18n } from '@/hooks/useI18n'
import { useAppStore } from '@/store/useAppStore'

export function HistoryPage() {
  const { t, locale } = useI18n()
  const meals = useAppStore((s) => s.meals)
  const removeMeal = useAppStore((s) => s.removeMeal)

  const grouped = meals.reduce<Record<string, typeof meals>>((acc, meal) => {
    const key = new Date(meal.createdAt).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    ;(acc[key] ??= []).push(meal)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-brand-ink dark:text-white">
          {t.history.title}
        </h1>
        <p className="mt-1 text-brand-muted dark:text-white/60">{t.history.subtitle}</p>
      </div>

      {meals.length === 0 ? (
        <div className="glass-card p-8 text-center text-brand-muted dark:text-white/55">{t.history.empty}</div>
      ) : (
        Object.entries(grouped).map(([day, dayMeals]) => (
          <section key={day} className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-brand-ink dark:text-white">{day}</h2>
            {dayMeals.map((m) => (
              <MealCard key={m.id} meal={m} onDelete={removeMeal} />
            ))}
          </section>
        ))
      )}
    </div>
  )
}
