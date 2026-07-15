import type { Locale, ThemeMode } from '@/i18n/translations'

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'
export type VisionDetail = 'low' | 'high' | 'original' | 'auto'
export type GoalVerdict = 'help' | 'caution' | 'neutral'
export type BiologicalSex = 'female' | 'male' | 'unspecified'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

export interface FoodItemEstimate {
  name: string
  grams: number
  calories: number
}

export interface FieldConfidence {
  food: number
  grams: number
  calories: number
  protein: number
  fat: number
  carbs: number
}

export interface GoalImpact {
  verdict: GoalVerdict
  message: string
}

export interface NutritionResult {
  food: string
  grams: number
  calories: number
  protein: number
  fat: number
  carbs: number
  confidence: number
  ingredients?: string[]
  tip?: string
  is_unclear?: boolean
  items?: FoodItemEstimate[]
  visible_text?: string
  image_quality?: 'low' | 'medium' | 'high'
  portion_note?: string
  portionBasis?: string
  assumptions?: string[]
  fieldConfidence?: FieldConfidence
  goalImpact?: GoalImpact
  detail?: string
  image_count?: number
  model?: string
  twoPass?: boolean
}

export interface CoachTrendBlock {
  direction: string
  estimate_4w?: string
  explanation: string
}

export interface CoachResult {
  summary: string
  advice: string
  focus: string[]
  score: number
  predicted_goal_note: string
  weight_trend?: CoachTrendBlock
  muscle_trend?: CoachTrendBlock
  energy_trend?: CoachTrendBlock
  outlook_2w?: string
  outlook_4w?: string
  outlook_8w?: string
  disclaimer?: string
  stats?: {
    days_logged: number
    avg_daily_calories: number
    avg_daily_protein: number
    avg_daily_carbs: number
    avg_daily_fat: number
  }
}

export interface MealRecommendOption {
  title: string
  calories: number
  protein: number
  carbs: number
  fat: number
  reason: string
}

export interface MealRecommendResult {
  meal_slot: string
  remaining_note: string
  options: MealRecommendOption[]
  tip: string
  remaining?: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
}

export interface MealEntry extends NutritionResult {
  id: string
  mealType: MealType
  imageDataUrl?: string
  createdAt: string
}

export interface DailyGoals {
  calories: number
  protein: number
  carbs: number
  fat: number
  waterMl: number
  exerciseMin: number
}

export interface UserSettings {
  name: string
  goals: DailyGoals
  currentWeightKg: number
  goalWeightKg: number
  /** True after the first-launch name/weight setup. */
  profileSetupDone: boolean
  /** Used for calorie recommendation (Mifflin–St Jeor). */
  sex: BiologicalSex
  heightCm: number
  age: number
  activityLevel: ActivityLevel
  /** True after user applied the built-in recommender at least once. */
  goalsFromRecommend: boolean
  locale: Locale
  theme: ThemeMode
  visionModel: string
  visionTwoPass: boolean
  visionDetail: VisionDetail
}

export const DEFAULT_GOALS: DailyGoals = {
  calories: 2000,
  protein: 120,
  carbs: 220,
  fat: 65,
  waterMl: 2000,
  exerciseMin: 30,
}

export const DEFAULT_SETTINGS: UserSettings = {
  name: '',
  goals: DEFAULT_GOALS,
  currentWeightKg: 0,
  goalWeightKg: 0,
  profileSetupDone: false,
  sex: 'unspecified',
  heightCm: 165,
  age: 35,
  activityLevel: 'light',
  goalsFromRecommend: false,
  locale: 'ko',
  theme: 'light',
  visionModel: '',
  visionTwoPass: true,
  visionDetail: 'high',
}

export function weightGoalMode(current: number, goal: number): 'lose' | 'gain' | 'maintain' {
  const diff = goal - current
  if (diff < -0.5) return 'lose'
  if (diff > 0.5) return 'gain'
  return 'maintain'
}

const SEX_OK = new Set(['female', 'male', 'unspecified'])
const ACTIVITY_OK = new Set(['sedentary', 'light', 'moderate', 'active', 'very_active'])

export function normalizeSettings(raw: Partial<UserSettings> | undefined): UserSettings {
  const sex = SEX_OK.has(String(raw?.sex)) ? (raw!.sex as BiologicalSex) : DEFAULT_SETTINGS.sex
  const activityLevel = ACTIVITY_OK.has(String(raw?.activityLevel))
    ? (raw!.activityLevel as ActivityLevel)
    : DEFAULT_SETTINGS.activityLevel
  return {
    name: typeof raw?.name === 'string' ? raw.name.trim() : DEFAULT_SETTINGS.name,
    goals: { ...DEFAULT_GOALS, ...raw?.goals },
    currentWeightKg: Number(raw?.currentWeightKg) > 0 ? Number(raw?.currentWeightKg) : 0,
    goalWeightKg: Number(raw?.goalWeightKg) > 0 ? Number(raw?.goalWeightKg) : 0,
    profileSetupDone: Boolean(raw?.profileSetupDone),
    sex,
    heightCm: Number(raw?.heightCm) > 0 ? Number(raw?.heightCm) : DEFAULT_SETTINGS.heightCm,
    age: Number(raw?.age) > 0 ? Number(raw?.age) : DEFAULT_SETTINGS.age,
    activityLevel,
    goalsFromRecommend: Boolean(raw?.goalsFromRecommend),
    locale: raw?.locale === 'en' ? 'en' : 'ko',
    theme: raw?.theme === 'dark' ? 'dark' : 'light',
    // Vision pipeline is app-controlled for reliability — ignore stored overrides.
    visionModel: '',
    visionTwoPass: true,
    visionDetail: 'high',
  }
}
