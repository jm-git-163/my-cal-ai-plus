import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getModel, getOpenAI } from '../lib/openai'

const foodSchema = {
  type: 'object',
  properties: {
    food: { type: 'string' },
    grams: { type: 'number' },
    calories: { type: 'number' },
    protein: { type: 'number' },
    fat: { type: 'number' },
    carbs: { type: 'number' },
    confidence: { type: 'number' },
    ingredients: {
      type: 'array',
      items: { type: 'string' },
    },
    tip: { type: 'string' },
    is_unclear: { type: 'boolean' },
  },
  required: [
    'food',
    'grams',
    'calories',
    'protein',
    'fat',
    'carbs',
    'confidence',
    'ingredients',
    'tip',
    'is_unclear',
  ],
  additionalProperties: false,
} as const

/**
 * Food vision via Responses API + Structured Outputs.
 * @see https://developers.openai.com/api/docs/guides/images-vision
 * @see https://developers.openai.com/api/docs/guides/structured-outputs
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { image, locale } = req.body as { image?: string; locale?: string }
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Missing image (base64 data URL)' })
    }
    if (!image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'image must be a data URL' })
    }
    if (image.length > 5_500_000) {
      return res.status(413).json({ error: 'Image too large. Please use a smaller photo.' })
    }

    const lang = locale === 'en' ? 'English' : 'Korean'
    const client = getOpenAI()
    const model = getModel()

    const response = await client.responses.create({
      model,
      instructions: `You are a nutrition vision expert for My Cal AI Plus.
Analyze the food photo and estimate dish name, portion grams, calories, and macros (protein/fat/carbs in grams).
confidence is 0–1. If the image is not food or is too unclear, set is_unclear=true, lower confidence, and still return best-effort conservative estimates.
ingredients: short list of visible/main ingredients.
tip: one practical nutrition tip for this meal (max ~80 chars) in ${lang}.
food and tip language: ${lang}.`,
      text: {
        format: {
          type: 'json_schema',
          name: 'food_nutrition',
          strict: true,
          schema: foodSchema,
        },
      },
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Analyze this meal photo and return structured nutrition estimates.',
            },
            {
              type: 'input_image',
              image_url: image,
              detail: 'high',
            },
          ],
        },
      ],
    })

    for (const item of response.output) {
      if (item.type !== 'message') continue
      for (const part of item.content) {
        if (part.type === 'refusal') {
          return res.status(422).json({ error: part.refusal, refused: true })
        }
      }
    }

    const raw = response.output_text
    if (!raw) {
      return res.status(502).json({ error: 'Empty response from OpenAI' })
    }

    const parsed = JSON.parse(raw) as {
      food: string
      grams: number
      calories: number
      protein: number
      fat: number
      carbs: number
      confidence: number
      ingredients: string[]
      tip: string
      is_unclear: boolean
    }

    return res.status(200).json({
      food: parsed.food,
      grams: Math.round(parsed.grams),
      calories: Math.round(parsed.calories),
      protein: Math.round(parsed.protein * 10) / 10,
      fat: Math.round(parsed.fat * 10) / 10,
      carbs: Math.round(parsed.carbs * 10) / 10,
      confidence: Math.min(1, Math.max(0, parsed.confidence)),
      ingredients: parsed.ingredients?.slice(0, 8) ?? [],
      tip: parsed.tip || '',
      is_unclear: Boolean(parsed.is_unclear),
      model,
      usage: response.usage ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Vision analysis failed'
    console.error('[api/vision]', message)
    return res.status(500).json({ error: message })
  }
}
