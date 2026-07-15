import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { MacroRing } from '@/components/MacroRing'
import { MealCard } from '@/components/MealCard'
import { tReplace } from '@/i18n/translations'
import { useI18n } from '@/hooks/useI18n'
import { useAppStore } from '@/store/useAppStore'
import { sumNutrition, todayMeals } from '@/utils/nutrition'

export function DashboardPage() {
  const { t } = useI18n()
  const meals = useAppStore((s) => s.meals)
  const settings = useAppStore((s) => s.settings)
  const removeMeal = useAppStore((s) => s.removeMeal)
  const theme = settings.theme

  const today = useMemo(() => todayMeals(meals), [meals])
  const totals = useMemo(() => sumNutrition(today), [today])
  const { goals } = settings

  const fatSoft = theme === 'dark' ? '#2A3140' : '#EEF0F4'
  const fatAccent = theme === 'dark' ? '#E8ECF2' : '#1A1F2C'

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="text-sm font-medium text-brand-green">{t.dashboard.today}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-brand-ink dark:text-white sm:text-4xl">
          {tReplace(t.dashboard.hello, { name: settings.name })}
        </h1>
        <p className="max-w-xl text-brand-muted dark:text-white/60">{t.dashboard.subtitle}</p>
        <div className="pt-2">
          <Link to="/scan" className="btn-primary">
            {t.dashboard.scanFood}
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <MacroRing
          label={t.dashboard.calories}
          value={totals.calories}
          goal={goals.calories}
          unit="kcal"
          accent="#22A06B"
          soft={theme === 'dark' ? '#1A3D2E' : '#E8F6EF'}
        />
        <MacroRing
          label={t.dashboard.protein}
          value={totals.protein}
          goal={goals.protein}
          unit="g"
          accent="#2F6FED"
          soft={theme === 'dark' ? '#1A2A4A' : '#EAF0FE'}
        />
        <MacroRing
          label={t.dashboard.carbs}
          value={totals.carbs}
          goal={goals.carbs}
          unit="g"
          accent="#E88B2E"
          soft={theme === 'dark' ? '#3D2A14' : '#FFF4E8'}
        />
        <MacroRing
          label={t.dashboard.fat}
          value={totals.fat}
          goal={goals.fat}
          unit="g"
          accent={fatAccent}
          soft={fatSoft}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="glass-card p-5">
          <p className="text-sm font-medium text-brand-muted dark:text-white/55">{t.dashboard.water}</p>
          <p className="mt-2 font-display text-3xl font-bold text-brand-ink dark:text-white">
            0 <span className="text-base font-semibold text-brand-muted dark:text-white/50">/ {goals.waterMl} ml</span>
          </p>
          <p className="mt-2 text-xs text-brand-muted dark:text-white/45">{t.dashboard.waterHint}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm font-medium text-brand-muted dark:text-white/55">{t.dashboard.exercise}</p>
          <p className="mt-2 font-display text-3xl font-bold text-brand-ink dark:text-white">
            0{' '}
            <span className="text-base font-semibold text-brand-muted dark:text-white/50">
              / {goals.exerciseMin} min
            </span>
          </p>
          <p className="mt-2 text-xs text-brand-muted dark:text-white/45">{t.dashboard.exerciseHint}</p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-brand-ink dark:text-white">
            {t.dashboard.todaysMeals}
          </h2>
          <Link to="/history" className="text-sm font-semibold text-brand-green hover:underline">
            {t.dashboard.viewAll}
          </Link>
        </div>
        {today.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="font-display text-lg font-semibold text-brand-ink dark:text-white">
              {t.dashboard.noMeals}
            </p>
            <p className="mt-1 text-sm text-brand-muted dark:text-white/55">{t.dashboard.noMealsHint}</p>
            <Link to="/scan" className="btn-primary mt-4">
              {t.dashboard.openScan}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {today.map((m) => (
              <MealCard key={m.id} meal={m} onDelete={removeMeal} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
