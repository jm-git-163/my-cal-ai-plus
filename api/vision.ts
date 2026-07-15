import type { VercelRequest, VercelResponse } from '@vercel/node'
import OpenAI from 'openai'

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
  },
  required: ['food', 'grams', 'calories', 'protein', 'fat', 'carbs', 'confidence'],
  additionalProperties: false,
} as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' })
  }

  const { image } = req.body as { image?: string }
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Missing image (base64 data URL)' })
  }

  if (!image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'image must be a data URL' })
  }

  // Cap ~4MB base64 payload
  if (image.length > 5_500_000) {
    return res.status(413).json({ error: 'Image too large. Please use a smaller photo.' })
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o'
  const client = new OpenAI({ apiKey })

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'food_nutrition',
          strict: true,
          schema: foodSchema,
        },
      },
      messages: [
        {
          role: 'system',
          content:
            'You are a nutrition vision expert for My Cal AI Plus. Analyze the food photo and estimate dish name, portion weight in grams, calories, and macros (protein/fat/carbs in grams). confidence is 0–1. Be realistic; if unclear, lower confidence and make conservative estimates.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this meal photo and return structured nutrition estimates.',
            },
            {
              type: 'image_url',
              image_url: { url: image, detail: 'high' },
            },
          ],
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content
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
    }

    return res.status(200).json({
      food: parsed.food,
      grams: Math.round(parsed.grams),
      calories: Math.round(parsed.calories),
      protein: Math.round(parsed.protein * 10) / 10,
      fat: Math.round(parsed.fat * 10) / 10,
      carbs: Math.round(parsed.carbs * 10) / 10,
      confidence: Math.min(1, Math.max(0, parsed.confidence)),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Vision analysis failed'
    console.error('[api/vision]', message)
    return res.status(500).json({ error: message })
  }
}
