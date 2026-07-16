import type { ActivityLevel, BiologicalSex, DailyGoals, UserSettings } from '@/types'
import { weightGoalMode } from '@/types'
import {
  maxSustainableDeficit,
  maxSustainableSurplus,
  safeDailyCalorieFloor,
} from '@/utils/healthSafety'

export type { ActivityLevel, BiologicalSex }

export interface GoalRecommendation {
  goals: DailyGoals
  bmr: number
  tdee: number
  mode: 'lose' | 'gain' | 'maintain'
  calorieAdjust: number
  /** Soft daily calorie floor used when recommending (health guardrail). */
  safeCalorieFloor: number
  healthNote: string
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
 * Sustainable deficit + protein-first macros — never a crash-diet target.
 */
export function recommendDailyGoals(
  settings: Pick<UserSettings, 'currentWeightKg' | 'goalWeightKg' | 'sex' | 'heightCm' | 'age' | 'activityLevel'>,
  locale: 'ko' | 'en' = 'ko',
): GoalRecommendation {
  const weight = clamp(settings.currentWeightKg || 70, 35, 250)
  const height = clamp(settings.heightCm || 165, 120, 230)
  const age = clamp(settings.age || 35, 14, 90)
  const sex = settings.sex || 'unspecified'
  const activity = settings.activityLevel || 'light'
  const mode = weightGoalMode(settings.currentWeightKg, settings.goalWeightKg)

  const bmr = estimateBmr(weight, height, age, sex)
  const tdee = Math.round(bmr * ACTIVITY_MULT[activity])
  const floor = safeDailyCalorieFloor(bmr, sex)

  let calorieAdjust = 0
  if (mode === 'lose') calorieAdjust = -maxSustainableDeficit(tdee)
  if (mode === 'gain') calorieAdjust = maxSustainableSurplus()

  // Never recommend below the health floor, even if TDEE − deficit would.
  const ceiling = tdee + 800
  const rawTarget = tdee + calorieAdjust
  const calories = clamp(roundTo(Math.max(rawTarget, floor), 50), floor, ceiling)
  // If floor blocked a deeper cut, shrink the advertised adjust so UI stays honest.
  if (mode === 'lose' && calories > rawTarget) {
    calorieAdjust = calories - tdee
  }

  // Protein first while cutting — protects lean mass.
  const proteinPerKg = mode === 'lose' ? 2.0 : mode === 'gain' ? 1.8 : 1.6
  const protein = clamp(roundTo(weight * proteinPerKg, 5), 70, 220)

  const fat = clamp(roundTo((calories * 0.28) / 9, 5), 40, 120)
  const proteinKcal = protein * 4
  const fatKcal = fat * 9
  const carbs = clamp(roundTo(Math.max(0, calories - proteinKcal - fatKcal) / 4, 5), 90, 450)

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

  const healthNote =
    locale === 'en'
      ? `Sustainable plan: ~${Math.abs(calorieAdjust) || 0} kcal ${mode === 'lose' ? 'below' : mode === 'gain' ? 'above' : 'near'} maintenance, floor ${floor} kcal/day, protein prioritized for muscle & energy.`
      : `지속 가능한 목표: 유지칼로리 대비 약 ${Math.abs(calorieAdjust) || 0}kcal ${mode === 'lose' ? '부족' : mode === 'gain' ? '여유' : '근처'}, 하루 하한 ${floor}kcal, 근육·에너지를 위해 단백질을 우선합니다.`

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
    safeCalorieFloor: floor,
    healthNote,
  }
}
