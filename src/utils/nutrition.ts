import type { MealEntry, DailyGoals } from '@/types'

export function isSameDay(iso: string, date = new Date()) {
  const d = new Date(iso)
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  )
}

export function todayMeals(meals: MealEntry[]) {
  return meals.filter((m) => isSameDay(m.createdAt))
}

export function sumNutrition(meals: MealEntry[]) {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export function progressPct(value: number, goal: number) {
  if (goal <= 0) return 0
  return Math.min(100, Math.round((value / goal) * 100))
}

export function formatConfidence(c: number) {
  return `${Math.round(c * 100)}%`
}

export type MacroKey = keyof Pick<DailyGoals, 'calories' | 'protein' | 'carbs' | 'fat'>
