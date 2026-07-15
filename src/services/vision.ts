import type { NutritionResult } from '@/types'

const ALLOWED = /^image\/(png|jpeg|jpg|webp|gif|heic|heif)$/i

/**
 * Mobile cameras sometimes omit MIME or use HEIC.
 * Empty type is allowed — canvas decode decides success.
 */
export function validateImageFile(file: File): string | null {
  if (file.type && !ALLOWED.test(file.type)) return 'UNSUPPORTED_TYPE'
  if (file.size > 8 * 1024 * 1024) return 'TOO_LARGE'
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
  // One solid image is enough for most meals; dual images inflate latency.
  const primary = params.image
  const secondary =
    params.preprocess && params.preprocess !== params.image ? params.preprocess : undefined
  const images = [primary, secondary].filter(
    (u): u is string => typeof u === 'string' && u.length > 0,
  )

  const res = await fetch('/api/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      images,
      image: primary,
      locale: params.locale ?? 'ko',
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
