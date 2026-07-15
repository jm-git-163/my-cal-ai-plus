import type { ActivityLevel, BiologicalSex, DailyGoals, UserSettings } from '@/types'
import { weightGoalMode } from '@/types'

export type { ActivityLevel, BiologicalSex }

export interface GoalRecommendation {
  goals: DailyGoals
  bmr: number
  tdee: number
  mode: 'lose' | 'gain' | 'maintain'
  calorieAdjust: number
}

const ACTIVITY_MULT: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

/** Mifflin–St Jeor resting metabolic rate (kcal/day). */
export function estimateBmr(weightKg: number, heightCm: number, age: number, sex: BiologicalSex): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  if (sex === 'male') return Math.round(base + 5)
  if (sex === 'female') return Math.round(base - 161)
  // Unspecified: midpoint of male/female formulas
  return Math.round(base - 78)
}

function roundTo(n: number, step: number) {
  return Math.round(n / step) * step
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/**
 * Recommend daily nutrition targets from weight goals + simple body profile.
 * Uses Mifflin–St Jeor → TDEE → deficit/surplus, then proteins-first macros.
 */
export function recommendDailyGoals(
  settings: Pick<UserSettings, 'currentWeightKg' | 'goalWeightKg' | 'sex' | 'heightCm' | 'age' | 'activityLevel'>,
): GoalRecommendation {
  const weight = clamp(settings.currentWeightKg || 70, 35, 250)
  const height = clamp(settings.heightCm || 165, 120, 230)
  const age = clamp(settings.age || 35, 14, 90)
  const sex = settings.sex || 'unspecified'
  const activity = settings.activityLevel || 'light'
  const mode = weightGoalMode(settings.currentWeightKg, settings.goalWeightKg)

  const bmr = estimateBmr(weight, height, age, sex)
  const tdee = Math.round(bmr * ACTIVITY_MULT[activity])

  let calorieAdjust = 0
  if (mode === 'lose') calorieAdjust = -450
  if (mode === 'gain') calorieAdjust = 300

  const floor = sex === 'female' ? 1300 : sex === 'male' ? 1500 : 1400
  const ceiling = tdee + 800
  const calories = clamp(roundTo(tdee + calorieAdjust, 50), floor, ceiling)

  const proteinPerKg = mode === 'lose' ? 2.0 : mode === 'gain' ? 1.8 : 1.6
  const protein = clamp(roundTo(weight * proteinPerKg, 5), 60, 220)

  const fat = clamp(roundTo((calories * 0.28) / 9, 5), 35, 120)
  const proteinKcal = protein * 4
  const fatKcal = fat * 9
  const carbs = clamp(roundTo(Math.max(0, calories - proteinKcal - fatKcal) / 4, 5), 80, 450)

  const waterMl = clamp(roundTo(weight * 35, 100), 1500, 4000)
  const exerciseMin =
    activity === 'sedentary'
      ? 20
      : activity === 'light'
        ? 30
        : activity === 'moderate'
          ? 40
          : activity === 'active'
            ? 50
            : 60

  return {
    goals: {
      calories,
      protein,
      carbs,
      fat,
      waterMl,
      exerciseMin,
    },
    bmr,
    tdee,
    mode,
    calorieAdjust,
  }
}
