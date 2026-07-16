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
  /** @deprecated Ignored — single resized JPEG is enough and much faster. */
  preprocess?: string
  locale?: 'ko' | 'en'
  currentWeightKg?: number
  goalWeightKg?: number
  calorieGoal?: number
  /** What the photo alone missed or got wrong (flavor, hidden sides, etc.). */
  userCorrection?: string
}): Promise<NutritionResult> {
  const res = await fetch('/api/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: params.image,
      locale: params.locale ?? 'ko',
      currentWeightKg: params.currentWeightKg,
      goalWeightKg: params.goalWeightKg,
      calorieGoal: params.calorieGoal,
      userCorrection: params.userCorrection?.trim() || undefined,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Vision API error (${res.status})`)
  }

  return data as NutritionResult
}
