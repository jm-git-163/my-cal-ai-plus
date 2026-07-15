import type { Locale, ThemeMode } from '@/i18n/translations'

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'
export type VisionDetail = 'low' | 'high' | 'original' | 'auto'
export type GoalVerdict = 'help' | 'caution' | 'neutral'

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
  name: 'User',
  goals: DEFAULT_GOALS,
  currentWeightKg: 70,
  goalWeightKg: 65,
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

export function normalizeSettings(raw: Partial<UserSettings> | undefined): UserSettings {
  return {
    name: raw?.name || DEFAULT_SETTINGS.name,
    goals: { ...DEFAULT_GOALS, ...raw?.goals },
    currentWeightKg: Number(raw?.currentWeightKg) > 0 ? Number(raw?.currentWeightKg) : DEFAULT_SETTINGS.currentWeightKg,
    goalWeightKg: Number(raw?.goalWeightKg) > 0 ? Number(raw?.goalWeightKg) : DEFAULT_SETTINGS.goalWeightKg,
    locale: raw?.locale === 'en' ? 'en' : 'ko',
    theme: raw?.theme === 'dark' ? 'dark' : 'light',
    visionModel: typeof raw?.visionModel === 'string' ? raw.visionModel : '',
    visionTwoPass: raw?.visionTwoPass !== false,
    visionDetail:
      raw?.visionDetail === 'low' ||
      raw?.visionDetail === 'original' ||
      raw?.visionDetail === 'auto' ||
      raw?.visionDetail === 'high'
        ? raw.visionDetail
        : 'high',
  }
}
