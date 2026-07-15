import { useState } from 'react'
import type { CoachResult } from '@/types'
import { useI18n } from '@/hooks/useI18n'
import { fetchCoachAdvice, generateShareCard } from '@/services/coach'
import { useAppStore } from '@/store/useAppStore'

export function CoachPage() {
  const { t, locale } = useI18n()
  const meals = useAppStore((s) => s.meals)
  const settings = useAppStore((s) => s.settings)

  const [loading, setLoading] = useState(false)
  const [cardLoading, setCardLoading] = useState(false)
  const [coach, setCoach] = useState<CoachResult | null>(null)
  const [cardUrl, setCardUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runCoach() {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchCoachAdvice({
        meals,
        goals: settings.goals,
        locale,
        name: settings.name,
      })
      setCoach(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.coach.error)
    } finally {
      setLoading(false)
    }
  }

  async function runShareCard() {
    if (!coach) return
    setCardLoading(true)
    setError(null)
    try {
      const image = await generateShareCard({
        headline: coach.summary.slice(0, 60),
        subtitle: coach.advice.slice(0, 80),
        locale,
      })
      setCardUrl(image)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.coach.error)
    } finally {
      setCardLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-brand-ink dark:text-white">
          {t.coach.title}
        </h1>
        <p className="mt-1 text-brand-muted dark:text-white/60">{t.coach.subtitle}</p>
      </div>

      {meals.length === 0 && (
        <div className="glass-card p-5 text-sm text-brand-muted dark:text-white/55">{t.coach.empty}</div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={loading} onClick={() => void runCoach()}>
          {loading ? t.coach.loading : t.coach.refresh}
        </button>
        {coach && (
          <button
            type="button"
            className="btn-secondary"
            disabled={cardLoading}
            onClick={() => void runShareCard()}
          >
            {cardLoading ? t.coach.generatingCard : t.coach.shareCard}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {coach && (
        <div className="glass-card space-y-4 p-5 sm:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-brand-muted dark:text-white/50">{t.coach.score}</p>
              <p className="font-display text-4xl font-bold text-brand-green">{coach.score}</p>
            </div>
            <p className="max-w-xs text-right text-sm text-brand-muted dark:text-white/55">
              {coach.predicted_goal_note}
            </p>
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-brand-ink dark:text-white">{coach.summary}</h2>
            <p className="mt-2 text-brand-ink/90 dark:text-white/80">{coach.advice}</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-brand-muted dark:text-white/50">{t.coach.focus}</p>
            <div className="flex flex-wrap gap-2">
              {coach.focus.map((f) => (
                <span
                  key={f}
                  className="rounded-xl bg-brand-green-soft px-3 py-1 text-xs font-semibold text-brand-green dark:bg-brand-green/20"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {cardUrl && (
        <div className="glass-card space-y-3 p-5">
          <p className="text-sm font-semibold text-brand-ink dark:text-white">{t.coach.cardReady}</p>
          <img src={cardUrl} alt="Share card" className="mx-auto max-h-[480px] rounded-2xl" />
          <a href={cardUrl} download="my-cal-ai-plus-card.png" className="btn-secondary inline-flex">
            {t.coach.download}
          </a>
        </div>
      )}
    </div>
  )
}
