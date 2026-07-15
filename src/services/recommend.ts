import type { DailyGoals, MealEntry, MealRecommendResult } from '@/types'
import type { Locale } from '@/i18n/translations'
import { guessMealType } from '@/utils/preprocess'

export async function fetchMealRecommendations(params: {
  meals: MealEntry[]
  goals: DailyGoals
  locale: Locale
  name: string
  currentWeightKg?: number
  goalWeightKg?: number
}): Promise<MealRecommendResult> {
  const res = await fetch('/api/recommend', {
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
        waterMl: params.goals.waterMl,
      },
      currentWeightKg: params.currentWeightKg,
      goalWeightKg: params.goalWeightKg,
      locale: params.locale,
      name: params.name,
      mealSlot: guessMealType(),
      localHour: new Date().getHours(),
      nowIso: new Date().toISOString(),
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Recommend API error (${res.status})`)
  }

  return data as MealRecommendResult
}
