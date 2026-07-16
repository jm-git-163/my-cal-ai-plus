import type { CoachResult, DailyGoals, MealEntry } from '@/types'
import type { Locale } from '@/i18n/translations'

export async function fetchCoachAdvice(params: {
  meals: MealEntry[]
  goals: DailyGoals
  locale: Locale
  name: string
  currentWeightKg?: number
  goalWeightKg?: number
  sex?: string
  heightCm?: number
  age?: number
  bmr?: number
  todayTotals?: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
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
      sex: params.sex,
      heightCm: params.heightCm,
      age: params.age,
      bmr: params.bmr,
      todayTotals: params.todayTotals,
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
