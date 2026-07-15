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
  const remaining = goals.calories - totals.calories
  const calPct = goals.calories > 0 ? Math.min(100, (totals.calories / goals.calories) * 100) : 0

  const fatSoft = theme === 'dark' ? '#2A3140' : '#EEF0F4'
  const fatAccent = theme === 'dark' ? '#E8ECF2' : '#1A1F2C'

  return (
    <div className="mx-auto w-full space-y-5 md:space-y-7">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center rounded-full bg-brand-green/15 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-brand-green dark:bg-brand-green/20">
            {t.dashboard.today}
          </p>
          <h1 className="mt-2 font-display text-[1.75rem] font-bold leading-tight tracking-tight text-brand-ink dark:text-white sm:text-4xl">
            {t.dashboard.title}
          </h1>
          <p className="mt-1 text-sm text-brand-muted dark:text-white/55">{t.dashboard.subtitle}</p>
        </div>
        <div className="hidden gap-2 sm:flex">
          <Link to="/coach" className="btn-secondary">
            {t.dashboard.askCoach}
          </Link>
          <Link to="/scan" className="btn-primary">
            {t.dashboard.scanFood}
          </Link>
        </div>
      </section>

      <section>
        <div className="glass-card relative overflow-hidden p-5 sm:p-7">
          <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-brand-green/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-brand-orange/15 blur-3xl dark:opacity-40" />
          <p className="text-sm font-medium text-brand-muted dark:text-white/50">{t.dashboard.calories}</p>
          <div className="mt-1 flex flex-wrap items-end gap-x-2 gap-y-1">
            <p className="tabular font-display text-5xl font-bold tracking-[-0.045em] text-brand-ink dark:text-white sm:text-6xl lg:text-7xl">
              {Math.round(totals.calories)}
            </p>
            <p className="mb-2 tabular text-sm font-semibold text-brand-muted">/ {goals.calories}</p>
          </div>
          <p className="mt-1 text-sm text-brand-muted dark:text-white/50">
            {remaining >= 0
              ? tReplace(t.dashboard.remaining, { n: String(Math.round(remaining)) })
              : t.dashboard.overGoal}
          </p>
          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-green to-emerald-400 transition-all duration-700 ease-out"
              style={{ width: `${calPct}%` }}
            />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:hidden">
            <Link to="/scan" className="btn-primary text-center">
              {t.dashboard.scanFood}
            </Link>
            <Link to="/coach" className="btn-secondary text-center">
              {t.dashboard.askCoach}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2.5 sm:gap-3">
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

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-brand-ink dark:text-white">
            {t.dashboard.todaysMeals}
          </h2>
          <Link to="/history" className="text-sm font-semibold text-brand-green">
            {t.dashboard.viewAll}
          </Link>
        </div>
        {today.length === 0 ? (
          <Link
            to="/scan"
            className="glass-card flex flex-col items-center justify-center gap-3 p-10 text-center transition duration-300 hover:-translate-y-0.5"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-green text-2xl text-white shadow-[0_10px_28px_rgba(34,160,107,0.35)]">
              +
            </span>
            <div>
              <p className="font-display text-lg font-semibold text-brand-ink dark:text-white">
                {t.dashboard.noMeals}
              </p>
              <p className="mt-1 text-sm text-brand-muted dark:text-white/55">{t.dashboard.tapScan}</p>
            </div>
          </Link>
        ) : (
          <div className="space-y-2.5">
            {today.map((m) => (
              <MealCard key={m.id} meal={m} onDelete={removeMeal} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
