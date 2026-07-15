import type { NutritionResult } from '@/types'

export async function analyzeFoodImage(
  imageDataUrl: string,
  locale: 'ko' | 'en' = 'ko',
): Promise<NutritionResult> {
  const res = await fetch('/api/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageDataUrl, locale }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Vision API error (${res.status})`)
  }

  return data as NutritionResult
}
