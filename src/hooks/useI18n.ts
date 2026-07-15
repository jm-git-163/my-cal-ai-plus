import { translations, type Locale, type TranslationTree } from '@/i18n/translations'
import { useAppStore } from '@/store/useAppStore'

export function useI18n() {
  const locale = useAppStore((s) => s.settings.locale)
  const t: TranslationTree = translations[locale]
  return { locale, t, translations }
}

export function mealTypeLabel(locale: Locale, mealType: string) {
  const map = translations[locale].meal
  switch (mealType) {
    case 'Breakfast':
      return map.breakfast
    case 'Lunch':
      return map.lunch
    case 'Dinner':
      return map.dinner
    case 'Snack':
      return map.snack
    default:
      return mealType
  }
}
