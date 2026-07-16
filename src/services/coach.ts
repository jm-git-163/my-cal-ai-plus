import type { CoachResult, DailyGoals, MealEntry } from '@/types'
import type { Locale } from '@/i18n/translations'
import { clipShareText, renderShareCard, SHARE_CARD_DESIGN } from '@/utils/shareCard'

export { SHARE_CARD_DESIGN }

export async function fetchCoachAdvice(params: {
  meals: MealEntry[]
  goals: DailyGoals
  locale: Locale
  name: string
  currentWeightKg?: number
  goalWeightKg?: number
}): Promise<CoachResult> {
  const res = await fetch('/api/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      meals: params.meals.slice(0, 30).map((m) => ({
        food: m.food,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        mealType: m.mealType,
        createdAt: m.createdAt,
      })),
      goals: {
        calories: params.goals.calories,
        protein: params.goals.protein,
        carbs: params.goals.carbs,
        fat: params.goals.fat,
        exerciseMin: params.goals.exerciseMin,
      },
      currentWeightKg: params.currentWeightKg,
      goalWeightKg: params.goalWeightKg,
      locale: params.locale,
      name: params.name,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Coach API error (${res.status})`)
  }

  return data as CoachResult
}

/** Canvas card — exact coach copy, no AI misspellings or mid-sentence cuts. */
export async function generateShareCard(params: {
  headline: string
  subtitle: string
  locale: Locale
  score?: number
}): Promise<string> {
  return renderShareCard({
    headline: clipShareText(params.headline, 48),
    subtitle: clipShareText(params.subtitle, 72),
    score: params.score,
    locale: params.locale,
  })
}
