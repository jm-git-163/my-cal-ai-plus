import { useEffect, useMemo, useState } from 'react'
import type { CoachResult, MealRecommendResult } from '@/types'
import { CoachWaitPanel } from '@/components/CoachWaitPanel'
import { ScoreGauge, scoreBandKey } from '@/components/ScoreGauge'
import { tReplace } from '@/i18n/translations'
import { useI18n } from '@/hooks/useI18n'
import { fetchCoachAdvice } from '@/services/coach'
import { fetchMealRecommendations } from '@/services/recommend'
import { useAppStore } from '@/store/useAppStore'
import { sumNutrition, todayMeals } from '@/utils/nutrition'

function directionLabel(
  t: ReturnType<typeof useI18n>['t'],
  kind: 'weight' | 'muscle' | 'energy',
  direction: string,
) {
  if (kind === 'weight') {
    if (direction === 'lose') return t.coach.directionLose
    if (direction === 'gain') return t.coach.directionGain
    return t.coach.directionMaintain
  }
  if (kind === 'muscle') {
    if (direction === 'increase') return t.coach.directionIncrease
    if (direction === 'decrease') return t.coach.directionDecrease
    return t.coach.directionMaintain
  }
  if (direction === 'up') return t.coach.directionUp
  if (direction === 'down') return t.coach.directionDown
  return t.coach.directionStable
}

function directionTone(direction: string) {
  if (['lose', 'decrease', 'down'].includes(direction)) {
    return 'bg-brand-orange-soft text-brand-orange dark:bg-brand-orange/20'
  }
  if (['gain', 'increase', 'up'].includes(direction)) {
    return 'bg-brand-blue-soft text-brand-blue dark:bg-brand-blue/20'
  }
  return 'bg-brand-green-soft text-brand-green dark:bg-brand-green/20'
}

function bandLabelFor(
  t: ReturnType<typeof useI18n>['t'],
  score: number,
) {
  const band = scoreBandKey(score)
  if (band === 'great') return t.coach.scoreBandGreat
  if (band === 'good') return t.coach.scoreBandGood
  if (band === 'mid') return t.coach.scoreBandMid
  return t.coach.scoreBandLow
}

export function CoachPage() {
  const { t, locale } = useI18n()
  const meals = useAppStore((s) => s.meals)
  const settings = useAppStore((s) => s.settings)

  const [loading, setLoading] = useState(false)
  const [recommendLoading, setRecommendLoading] = useState(false)
  const [coach, setCoach] = useState<CoachResult | null>(null)
  const [recommend, setRecommend] = useState<MealRecommendResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [staleLocale, setStaleLocale] = useState(false)
  const [resultLocale, setResultLocale] = useState<typeof locale | null>(null)

  const todayTotals = useMemo(() => sumNutrition(todayMeals(meals)), [meals])
  const remaining = useMemo(
    () => ({
      calories: Math.round(settings.goals.calories - todayTotals.calories),
      protein: Math.round(settings.goals.protein - todayTotals.protein),
    }),
    [settings.goals, todayTotals],
  )

  useEffect(() => {
    if (resultLocale && resultLocale !== locale) {
      setStaleLocale(true)
    }
  }, [locale, resultLocale])

  async function runCoach() {
    setLoading(true)
    setError(null)
    setStaleLocale(false)
    try {
      const result = await fetchCoachAdvice({
        meals: meals.slice(0, 20),
        goals: settings.goals,
        locale,
        name: settings.name,
        currentWeightKg: settings.currentWeightKg,
        goalWeightKg: settings.goalWeightKg,
      })
      setCoach(result)
      setResultLocale(locale)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.coach.error)
    } finally {
      setLoading(false)
    }
  }

  async function runRecommend() {
    setRecommendLoading(true)
    setError(null)
    try {
      const result = await fetchMealRecommendations({
        meals: meals.slice(0, 16),
        goals: settings.goals,
        locale,
        name: settings.name,
        currentWeightKg: settings.currentWeightKg,
        goalWeightKg: settings.goalWeightKg,
      })
      setRecommend(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.coach.whatToEatError)
    } finally {
      setRecommendLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm font-medium text-brand-green">{t.nav.coach}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-brand-ink dark:text-white">
          {t.coach.title}
        </h1>
        <p className="mt-1 text-brand-muted dark:text-white/60">{t.coach.subtitle}</p>
      </div>

      {meals.length === 0 && (
        <div className="glass-card space-y-1 p-5 text-sm text-brand-muted dark:text-white/55">
          <p>{t.coach.empty}</p>
          <p>{t.coach.whatToEatEmptyOk}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={recommendLoading}
          onClick={() => void runRecommend()}
        >
          {recommendLoading ? t.coach.whatToEatLoading : t.coach.whatToEat}
        </button>
        <button type="button" className="btn-secondary" disabled={loading} onClick={() => void runCoach()}>
          {loading ? t.coach.loading : t.coach.refresh}
        </button>
      </div>

      <div className="rounded-2xl bg-brand-green-soft/70 px-4 py-3 text-sm text-brand-ink dark:bg-brand-green/15 dark:text-white/80">
        {tReplace(t.dashboard.remaining, { n: String(Math.max(0, remaining.calories)) })}
        {' · '}
        P {Math.max(0, remaining.protein)}g
      </div>

      {staleLocale && (
        <div className="rounded-2xl border border-brand-orange/30 bg-brand-orange-soft/60 px-4 py-3 text-sm text-brand-orange dark:bg-brand-orange/15">
          {t.coach.reanalyzeHint}
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {recommendLoading && (
        <CoachWaitPanel
          mode="recommend"
          title={t.coach.waitTitleRecommend}
          stages={t.coach.waitStagesRecommend}
          tips={t.coach.waitTips}
          almost={t.coach.waitAlmost}
          hint={t.coach.waitHint}
          tipLabel={t.coach.tipLabel}
        />
      )}

      {loading && (
        <CoachWaitPanel
          mode="coach"
          title={t.coach.waitTitleCoach}
          stages={t.coach.waitStagesCoach}
          tips={t.coach.waitTips}
          almost={t.coach.waitAlmost}
          hint={t.coach.waitHint}
          tipLabel={t.coach.tipLabel}
        />
      )}

      {recommend && !recommendLoading && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold text-brand-ink dark:text-white">
                {t.coach.whatToEatTitle}
              </h2>
              <p className="mt-0.5 text-sm text-brand-muted dark:text-white/55">
                {recommend.meal_slot} · {recommend.remaining_note}
              </p>
            </div>
          </div>

          {recommend.situation_note && (
            <p className="rounded-2xl border border-brand-green/20 bg-brand-green-soft/80 px-4 py-3 text-sm leading-relaxed text-brand-ink dark:border-brand-green/30 dark:bg-brand-green/15 dark:text-white/85">
              {recommend.situation_note}
            </p>
          )}

          <div className="space-y-2.5">
            {recommend.options.map((opt, i) => {
              const kind = opt.kind || 'meal'
              const isHydrate = kind === 'hydrate' || kind === 'rest'
              const kindLabel =
                kind === 'hydrate'
                  ? t.coach.kindHydrate
                  : kind === 'rest'
                    ? t.coach.kindRest
                    : kind === 'snack'
                      ? t.coach.kindSnack
                      : t.coach.kindMeal
              const kindTone = isHydrate
                ? 'bg-brand-blue-soft text-brand-blue dark:bg-brand-blue/20'
                : kind === 'snack'
                  ? 'bg-brand-orange-soft text-brand-orange dark:bg-brand-orange/20'
                  : 'bg-brand-green-soft text-brand-green dark:bg-brand-green/20'

              return (
                <article
                  key={`${opt.title}-${i}`}
                  className={`glass-card space-y-2 p-4 sm:p-5 ${
                    isHydrate ? 'ring-1 ring-brand-blue/20 dark:ring-brand-blue/30' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1.5">
                      <span
                        className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${kindTone}`}
                      >
                        {kindLabel}
                      </span>
                      <h3 className="font-display text-lg font-semibold leading-snug text-brand-ink text-balance-ko dark:text-white">
                        {opt.title}
                      </h3>
                    </div>
                    <p className="tabular shrink-0 font-display text-xl font-bold text-brand-green">
                      {opt.calories}
                      <span className="ml-1 text-sm font-semibold text-brand-muted">kcal</span>
                    </p>
                  </div>
                  {!isHydrate && (
                    <p className="text-sm font-medium text-brand-muted dark:text-white/60">
                      {tReplace(t.coach.macrosShort, {
                        p: String(opt.protein),
                        c: String(opt.carbs),
                        f: String(opt.fat),
                      })}
                    </p>
                  )}
                  <p className="text-sm leading-relaxed text-brand-ink/90 text-balance-ko dark:text-white/75">
                    {opt.reason}
                  </p>
                </article>
              )
            })}
          </div>
          {recommend.tip && (
            <p className="rounded-2xl bg-black/[0.03] px-4 py-3 text-sm text-brand-ink dark:bg-white/5 dark:text-white/75">
              <span className="font-semibold text-brand-green">{t.coach.tipLabel}</span> {recommend.tip}
            </p>
          )}
        </section>
      )}

      {coach && !loading && (
        <div className="space-y-4">
          <div className="glass-card space-y-4 p-5 sm:p-6">
            <div className="flex flex-col gap-4">
              <ScoreGauge
                score={coach.score}
                label={t.coach.score}
                outOfLabel={tReplace(t.coach.scoreOutOf, { n: String(Math.round(coach.score)) })}
                bandLabel={bandLabelFor(t, coach.score)}
                hint={t.coach.scoreHint}
              />
              {coach.predicted_goal_note && (
                <p className="text-balance-ko rounded-2xl bg-black/[0.03] px-4 py-3 text-sm leading-relaxed text-brand-muted dark:bg-white/5 dark:text-white/55">
                  {coach.predicted_goal_note}
                </p>
              )}
            </div>
            <div className="text-balance-ko">
              <h2 className="font-display text-xl font-semibold leading-snug text-brand-ink dark:text-white">
                {coach.summary}
              </h2>
              <p className="mt-2 leading-relaxed text-brand-ink/90 dark:text-white/80">{coach.advice}</p>
            </div>
            <div>
              <p className="mb-2 text-nowrap-keep text-sm font-medium text-brand-muted dark:text-white/50">
                {t.coach.focus}
              </p>
              <div className="flex flex-wrap gap-2">
                {coach.focus.map((f) => (
                  <span
                    key={f}
                    className="rounded-xl bg-brand-green-soft px-3 py-1 text-xs font-semibold text-brand-green text-balance-ko dark:bg-brand-green/20"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>

            {coach.stats && coach.stats.days_logged > 0 && (
              <div className="space-y-2">
                {(coach.stats.incomplete_logging ||
                  coach.stats.confidence === 'low' ||
                  coach.stats.fills_unlogged_meals) && (
                  <p className="rounded-2xl border border-brand-orange/25 bg-brand-orange-soft/70 px-4 py-3 text-sm leading-relaxed text-brand-orange dark:border-brand-orange/30 dark:bg-brand-orange/15">
                    {t.coach.confidenceLow}
                  </p>
                )}
                {coach.stats.confidence === 'medium' && !coach.stats.incomplete_logging && (
                  <p className="rounded-2xl bg-brand-blue-soft/80 px-4 py-3 text-sm leading-relaxed text-brand-blue dark:bg-brand-blue/15">
                    {tReplace(t.coach.confidenceMedium, {
                      n: String(coach.stats.complete_days ?? coach.stats.days_logged),
                    })}
                  </p>
                )}
                {coach.stats.confidence === 'high' && (
                  <p className="text-xs text-brand-muted dark:text-white/45">
                    {tReplace(t.coach.confidenceHigh, {
                      n: String(coach.stats.complete_days ?? coach.stats.days_logged),
                    })}
                  </p>
                )}
                <div className="rounded-2xl bg-black/[0.03] px-4 py-3 dark:bg-white/5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted dark:text-white/45">
                    {coach.stats.projection_usable ? t.coach.projectedNote : t.coach.loggedOnlyNote}
                    {' · '}
                    {tReplace(t.coach.daysLogged, { n: String(coach.stats.days_logged) })}
                  </p>
                  <p className="mt-1 text-sm text-brand-ink dark:text-white/80">
                    {coach.stats.projection_usable && coach.stats.projected_daily_calories != null
                      ? coach.stats.projected_daily_calories
                      : coach.stats.avg_daily_calories}{' '}
                    kcal · P {coach.stats.avg_daily_protein}g · C {coach.stats.avg_daily_carbs}g · F{' '}
                    {coach.stats.avg_daily_fat}g
                  </p>
                  {!!coach.stats.fills_unlogged_meals &&
                    (coach.stats.estimated_fill_kcal_avg ?? 0) > 0 && (
                      <p className="mt-1 text-xs text-brand-muted dark:text-white/50">
                        {tReplace(t.coach.fillNote, {
                          n: String(Math.round(coach.stats.estimated_fill_kcal_avg ?? 0)),
                        })}
                      </p>
                    )}
                </div>
              </div>
            )}
          </div>

          {(coach.weight_trend || coach.muscle_trend || coach.energy_trend) && (
            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-brand-ink dark:text-white">
                {t.coach.trendsTitle}
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {coach.weight_trend && (
                  <article className="glass-card flex flex-col gap-2 p-4">
                    <p className="text-sm font-medium text-brand-muted text-balance-ko dark:text-white/50">
                      {t.coach.weight}
                    </p>
                    <span
                      className={`w-fit rounded-lg px-2 py-0.5 text-[11px] font-semibold ${directionTone(coach.weight_trend.direction)}`}
                    >
                      {directionLabel(t, 'weight', coach.weight_trend.direction)}
                    </span>
                    {coach.weight_trend.estimate_4w && (
                      <p className="font-display text-lg font-bold leading-snug text-brand-ink text-balance-ko dark:text-white">
                        {coach.weight_trend.estimate_4w}
                      </p>
                    )}
                    <p className="text-nowrap-keep text-xs text-brand-muted dark:text-white/55">
                      {t.coach.estimate4w}
                    </p>
                    <p className="text-sm leading-relaxed text-brand-ink/90 text-balance-ko dark:text-white/75">
                      {coach.weight_trend.explanation}
                    </p>
                  </article>
                )}
                {coach.muscle_trend && (
                  <article className="glass-card flex flex-col gap-2 p-4">
                    <p className="text-sm font-medium text-brand-muted text-balance-ko dark:text-white/50">
                      {t.coach.muscle}
                    </p>
                    <span
                      className={`w-fit rounded-lg px-2 py-0.5 text-[11px] font-semibold ${directionTone(coach.muscle_trend.direction)}`}
                    >
                      {directionLabel(t, 'muscle', coach.muscle_trend.direction)}
                    </span>
                    {coach.muscle_trend.estimate_4w && (
                      <p className="font-display text-lg font-bold leading-snug text-brand-ink text-balance-ko dark:text-white">
                        {coach.muscle_trend.estimate_4w}
                      </p>
                    )}
                    <p className="text-nowrap-keep text-xs text-brand-muted dark:text-white/55">
                      {t.coach.estimate4w}
                    </p>
                    <p className="text-sm leading-relaxed text-brand-ink/90 text-balance-ko dark:text-white/75">
                      {coach.muscle_trend.explanation}
                    </p>
                  </article>
                )}
                {coach.energy_trend && (
                  <article className="glass-card flex flex-col gap-2 p-4">
                    <p className="text-sm font-medium text-brand-muted text-balance-ko dark:text-white/50">
                      {t.coach.energy}
                    </p>
                    <span
                      className={`w-fit rounded-lg px-2 py-0.5 text-[11px] font-semibold ${directionTone(coach.energy_trend.direction)}`}
                    >
                      {directionLabel(t, 'energy', coach.energy_trend.direction)}
                    </span>
                    <p className="text-sm leading-relaxed text-brand-ink/90 text-balance-ko dark:text-white/75">
                      {coach.energy_trend.explanation}
                    </p>
                  </article>
                )}
              </div>
            </section>
          )}

          {(coach.outlook_2w || coach.outlook_4w || coach.outlook_8w) && (
            <section className="glass-card space-y-3 p-5">
              <h3 className="font-display text-lg font-semibold text-brand-ink dark:text-white">
                {t.coach.outlookTitle}
              </h3>
              {coach.outlook_2w && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">{t.coach.week2}</p>
                  <p className="mt-1 text-sm leading-relaxed text-brand-ink text-balance-ko dark:text-white/80">
                    {coach.outlook_2w}
                  </p>
                </div>
              )}
              {coach.outlook_4w && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">{t.coach.week4}</p>
                  <p className="mt-1 text-sm leading-relaxed text-brand-ink text-balance-ko dark:text-white/80">
                    {coach.outlook_4w}
                  </p>
                </div>
              )}
              {coach.outlook_8w && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">{t.coach.week8}</p>
                  <p className="mt-1 text-sm leading-relaxed text-brand-ink text-balance-ko dark:text-white/80">
                    {coach.outlook_8w}
                  </p>
                </div>
              )}
            </section>
          )}

          {coach.disclaimer && (
            <p className="px-1 text-xs text-brand-muted dark:text-white/45">{coach.disclaimer}</p>
          )}
        </div>
      )}
    </div>
  )
}
