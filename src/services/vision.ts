import type { NutritionResult } from '@/types'

const ALLOWED = /^image\/(png|jpeg|jpg|webp|gif)$/i

export function validateImageFile(file: File): string | null {
  if (!ALLOWED.test(file.type)) return 'UNSUPPORTED_TYPE'
  if (file.size > 4.5 * 1024 * 1024) return 'TOO_LARGE'
  return null
}

export async function analyzeFoodImage(params: {
  image: string
  preprocess?: string
  locale?: 'ko' | 'en'
  currentWeightKg?: number
  goalWeightKg?: number
  calorieGoal?: number
}): Promise<NutritionResult> {
  const images = [params.image, params.preprocess].filter(
    (u): u is string => typeof u === 'string' && u.length > 0,
  )

  const res = await fetch('/api/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      images,
      image: params.image,
      locale: params.locale ?? 'ko',
      // Server locks model / twoPass / detail for reliability.
      currentWeightKg: params.currentWeightKg,
      goalWeightKg: params.goalWeightKg,
      calorieGoal: params.calorieGoal,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Vision API error (${res.status})`)
  }

  return data as NutritionResult
}
