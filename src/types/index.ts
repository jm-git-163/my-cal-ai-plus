import type { Locale, ThemeMode } from '@/i18n/translations'

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'

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
}

export interface CoachResult {
  summary: string
  advice: string
  focus: string[]
  score: number
  predicted_goal_note: string
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
  locale: Locale
  theme: ThemeMode
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
  locale: 'ko',
  theme: 'light',
}

export function normalizeSettings(raw: Partial<UserSettings> | undefined): UserSettings {
  return {
    name: raw?.name || DEFAULT_SETTINGS.name,
    goals: { ...DEFAULT_GOALS, ...raw?.goals },
    locale: raw?.locale === 'en' ? 'en' : 'ko',
    theme: raw?.theme === 'dark' ? 'dark' : 'light',
  }
}
