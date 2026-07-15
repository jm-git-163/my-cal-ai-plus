import { create } from 'zustand'
import type { MealEntry, UserSettings } from '@/types'
import { DEFAULT_SETTINGS, normalizeSettings } from '@/types'
import type { Locale, ThemeMode } from '@/i18n/translations'
import * as db from '@/services/db'

interface AppState {
  meals: MealEntry[]
  settings: UserSettings
  hydrated: boolean
  hydrate: () => Promise<void>
  addMeal: (meal: MealEntry) => Promise<void>
  removeMeal: (id: string) => Promise<void>
  updateSettings: (settings: UserSettings) => Promise<void>
  setLocale: (locale: Locale) => Promise<void>
  setTheme: (theme: ThemeMode) => Promise<void>
}

function applyDocumentPrefs(settings: UserSettings) {
  document.documentElement.classList.toggle('dark', settings.theme === 'dark')
  document.documentElement.lang = settings.locale
  document.documentElement.style.colorScheme = settings.theme
}

export const useAppStore = create<AppState>((set, get) => ({
  meals: [],
  settings: DEFAULT_SETTINGS,
  hydrated: false,

  hydrate: async () => {
    const [meals, settings] = await Promise.all([db.getAllMeals(), db.getSettings()])
    let normalized = normalizeSettings(settings)

    // One-time product default: dark. Light choosers can switch back after.
    try {
      const flag = 'calai.themeDefaultDark.v1'
      if (!localStorage.getItem(flag)) {
        localStorage.setItem(flag, '1')
        if (normalized.theme !== 'dark') {
          normalized = { ...normalized, theme: 'dark' }
          await db.saveSettings(normalized)
        }
      }
    } catch {
      /* ignore */
    }

    applyDocumentPrefs(normalized)
    set({ meals, settings: normalized, hydrated: true })
  },

  addMeal: async (meal) => {
    await db.addMeal(meal)
    set({ meals: [meal, ...get().meals] })
  },

  removeMeal: async (id) => {
    await db.deleteMeal(id)
    set({ meals: get().meals.filter((m) => m.id !== id) })
  },

  updateSettings: async (settings) => {
    const normalized = normalizeSettings(settings)
    await db.saveSettings(normalized)
    applyDocumentPrefs(normalized)
    set({ settings: normalized })
  },

  setLocale: async (locale) => {
    await get().updateSettings({ ...get().settings, locale })
  },

  setTheme: async (theme) => {
    await get().updateSettings({ ...get().settings, theme })
  },
}))

