/**
 * Sustainable fat-loss / health guardrails for My Cal AI Plus.
 * Fat loss is a goal; crashing calories, skipping protein, or rewarding
 * extreme under-eating is not.
 */

export type SexLike = 'female' | 'male' | 'unspecified' | string | undefined

/** Absolute daily calorie floors (general adult guidance, not medical advice). */
export function absoluteCalorieFloor(sex?: SexLike): number {
  if (sex === 'female') return 1300
  if (sex === 'male') return 1500
  return 1400
}

/**
 * Prefer not going far below resting burn. Soft floor ≈ max(absolute, ~1.05×BMR).
 * Keeps “lose” goals from recommending crash diets.
 */
export function safeDailyCalorieFloor(bmr: number, sex?: SexLike): number {
  const abs = absoluteCalorieFloor(sex)
  const fromBmr = Math.round(Math.max(0, bmr) * 1.05)
  return Math.max(abs, fromBmr)
}

/** Max daily deficit vs TDEE: milder of fixed kcal and % of TDEE. */
export function maxSustainableDeficit(tdee: number): number {
  const byPct = Math.round(tdee * 0.2)
  return Math.min(500, Math.max(250, byPct))
}

/** Max surplus for gain mode. */
export function maxSustainableSurplus(): number {
  return 300
}

/**
 * Classify how aggressive intake is vs goal & a safe floor.
 * - on_target: near planned deficit/goal
 * - mild_under: a bit under goal (OK short-term if protein OK)
 * - unsafe_under: well below goal or below safe floor — do not reward
 * - over: above goal
 */
export function intakeHealthBand(
  dailyCalories: number,
  goalCalories: number,
  safeFloor: number,
): 'on_target' | 'mild_under' | 'unsafe_under' | 'over' | 'unknown' {
  if (dailyCalories <= 0 || goalCalories <= 0) return 'unknown'
  if (dailyCalories > goalCalories * 1.05) return 'over'
  if (dailyCalories < safeFloor || dailyCalories < goalCalories * 0.78) return 'unsafe_under'
  if (dailyCalories < goalCalories * 0.9) return 'mild_under'
  return 'on_target'
}

export function proteinAdequacy(
  dailyProtein: number,
  goalProtein: number,
): 'ok' | 'low' | 'critical' | 'unknown' {
  if (goalProtein <= 0 || dailyProtein < 0) return 'unknown'
  const r = dailyProtein / goalProtein
  if (r < 0.7) return 'critical'
  if (r < 0.9) return 'low'
  return 'ok'
}

/** Prefer eating (esp. protein) over skip/fast when under-fueled. */
export function shouldPrioritizeNourishment(params: {
  eatenCalories: number
  goalCalories: number
  eatenProtein: number
  goalProtein: number
  mealCount: number
  safeFloor?: number
}): boolean {
  const floor = params.safeFloor ?? 1200
  const { eatenCalories, goalCalories, eatenProtein, goalProtein, mealCount } = params
  if (mealCount === 0) return true
  if (eatenCalories < floor * 0.55) return true
  if (goalCalories > 0 && eatenCalories < goalCalories * 0.45 && mealCount <= 1) return true
  if (goalProtein > 0 && eatenProtein < goalProtein * 0.45) return true
  return false
}
