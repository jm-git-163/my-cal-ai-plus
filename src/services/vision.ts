import type { NutritionResult } from '@/types'

export async function analyzeFoodImage(imageDataUrl: string): Promise<NutritionResult> {
  const res = await fetch('/api/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageDataUrl }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Vision API error (${res.status})`)
  }

  return data as NutritionResult
}
