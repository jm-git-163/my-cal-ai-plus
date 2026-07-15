import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getModel, getOpenAI } from '../lib/openai.js'

export type VisionDetail = 'low' | 'high' | 'original' | 'auto'

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])

const pass1Schema = {
  type: 'object',
  properties: {
    food: { type: 'string' },
    ingredients: { type: 'array', items: { type: 'string' } },
    portionBasis: { type: 'string' },
    assumptions: { type: 'array', items: { type: 'string' } },
    visible_text: { type: 'string' },
    image_quality: { type: 'string', enum: ['low', 'medium', 'high'] },
    is_unclear: { type: 'boolean' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          grams_guess: { type: 'number' },
        },
        required: ['name', 'grams_guess'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'food',
    'ingredients',
    'portionBasis',
    'assumptions',
    'visible_text',
    'image_quality',
    'is_unclear',
    'items',
  ],
  additionalProperties: false,
} as const

const nutritionSchema = {
  type: 'object',
  properties: {
    food: { type: 'string' },
    grams: { type: 'number' },
    calories: { type: 'number' },
    protein: { type: 'number' },
    fat: { type: 'number' },
    carbs: { type: 'number' },
    confidence: { type: 'number' },
    ingredients: { type: 'array', items: { type: 'string' } },
    tip: { type: 'string' },
    is_unclear: { type: 'boolean' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          grams: { type: 'number' },
          calories: { type: 'number' },
        },
        required: ['name', 'grams', 'calories'],
        additionalProperties: false,
      },
    },
    visible_text: { type: 'string' },
    image_quality: { type: 'string', enum: ['low', 'medium', 'high'] },
    portion_note: { type: 'string' },
    portionBasis: { type: 'string' },
    assumptions: { type: 'array', items: { type: 'string' } },
    fieldConfidence: {
      type: 'object',
      properties: {
        food: { type: 'number' },
        grams: { type: 'number' },
        calories: { type: 'number' },
        protein: { type: 'number' },
        fat: { type: 'number' },
        carbs: { type: 'number' },
      },
      required: ['food', 'grams', 'calories', 'protein', 'fat', 'carbs'],
      additionalProperties: false,
    },
    goalImpact: {
      type: 'object',
      properties: {
        verdict: { type: 'string', enum: ['help', 'caution', 'neutral'] },
        message: { type: 'string' },
      },
      required: ['verdict', 'message'],
      additionalProperties: false,
    },
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
    'items',
    'visible_text',
    'image_quality',
    'portion_note',
    'portionBasis',
    'assumptions',
    'fieldConfidence',
    'goalImpact',
  ],
  additionalProperties: false,
} as const

function parseDataUrl(dataUrl: string): { mime: string } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/.exec(dataUrl)
  if (!m) return null
  return { mime: m[1].toLowerCase() }
}

function normalizeDetail(raw: unknown): VisionDetail {
  if (raw === 'low' || raw === 'high' || raw === 'original' || raw === 'auto') return raw
  return 'high'
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n))
}

function weightMode(current?: number, goal?: number): 'lose' | 'gain' | 'maintain' {
  if (!current || !goal) return 'maintain'
  const diff = goal - current
  if (diff < -0.5) return 'lose'
  if (diff > 0.5) return 'gain'
  return 'maintain'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body as {
      image?: string
      images?: string[]
      locale?: string
      detail?: VisionDetail
      model?: string
      twoPass?: boolean
      currentWeightKg?: number
      goalWeightKg?: number
      calorieGoal?: number
    }

    const detail = normalizeDetail(body.detail)
    const twoPass = body.twoPass !== false
    const lang = body.locale === 'en' ? 'English' : 'Korean'
    const model = (body.model && String(body.model).trim()) || getModel()
    const mode = weightMode(body.currentWeightKg, body.goalWeightKg)

    const candidates = [
      ...(Array.isArray(body.images) ? body.images : []),
      ...(typeof body.image === 'string' ? [body.image] : []),
    ].filter((u): u is string => typeof u === 'string' && u.length > 0)

    const unique: string[] = []
    for (const url of candidates) {
      if (!unique.includes(url)) unique.push(url)
      if (unique.length >= 2) break
    }

    if (unique.length === 0) {
      return res.status(400).json({ error: 'Missing image (base64 data URL)' })
    }

    for (const url of unique) {
      if (!url.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Each image must be a data URL' })
      }
      const parsed = parseDataUrl(url)
      const mime = parsed?.mime === 'image/jpg' ? 'image/jpeg' : parsed?.mime
      if (!mime || !ALLOWED_MIME.has(mime)) {
        return res.status(400).json({
          error: 'Unsupported image type. Use PNG, JPEG, WEBP, or non-animated GIF.',
        })
      }
      if (url.length > 5_500_000) {
        return res.status(413).json({ error: 'Image too large. Please use a smaller photo.' })
      }
    }

    const client = getOpenAI()

    const imageContent = unique.map((image_url) => ({
      type: 'input_image' as const,
      image_url,
      detail,
    }))

    let pass1Context: string | null = null

    if (twoPass) {
      const pass1 = await client.responses.create({
        model,
        instructions: `You are a food vision analyst (pass 1/2) for My Cal AI Plus.
Identify foods, ingredients, and HOW you estimate portion size.
Always output:
- portionBasis: concrete visual reference (plate diameter, utensil, hand, package label, etc.)
- assumptions: 2-5 explicit assumptions (oil, sauce, cooking method, hidden calories)
- uncertainty openly if blurry/occluded/rotated
Language for strings: ${lang}.`,
        text: {
          format: {
            type: 'json_schema',
            name: 'food_pass1',
            strict: true,
            schema: pass1Schema,
          },
        },
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text:
                  unique.length > 1
                    ? 'Image 1=original, Image 2=edge-enhanced preprocess. Identify foods and portion basis.'
                    : 'Identify foods and portion basis from this meal photo.',
              },
              ...imageContent,
            ],
          },
        ],
      })

      for (const item of pass1.output) {
        if (item.type !== 'message') continue
        for (const part of item.content) {
          if (part.type === 'refusal') {
            return res.status(422).json({ error: part.refusal, refused: true })
          }
        }
      }

      pass1Context = pass1.output_text
      if (!pass1Context) {
        return res.status(502).json({ error: 'Empty pass-1 response from OpenAI' })
      }
    }

    const goalCtx = {
      currentWeightKg: body.currentWeightKg ?? null,
      goalWeightKg: body.goalWeightKg ?? null,
      weightGoalMode: mode,
      calorieGoal: body.calorieGoal ?? null,
    }

    const pass2 = await client.responses.create({
      model,
      instructions: `You are a nutrition vision expert (pass ${twoPass ? '2/2' : '1'}) for My Cal AI Plus.
Return structured nutrition with REQUIRED uncertainty fields:
- portionBasis: visual reference used for grams
- assumptions: 2-5 short assumptions
- fieldConfidence: 0-1 per field (food, grams, calories, protein, fat, carbs)
- overall confidence 0-1
- goalImpact: compare this meal to user's weight goal mode (${mode}).
  help = supports goal, caution = hinders goal, neutral = mixed/insufficient context.
  Message in ${lang}, practical and non-medical.
Do NOT give medical advice. Counts/portions are approximate.
All user-facing strings in ${lang}.
${twoPass ? 'Use pass-1 JSON as prior; refine numbers but keep/improve uncertainty honesty.' : ''}`,
      text: {
        format: {
          type: 'json_schema',
          name: 'food_nutrition',
          strict: true,
          schema: nutritionSchema,
        },
      },
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                twoPass && pass1Context ? `Pass-1 prior JSON:\n${pass1Context}` : '',
                `User goal context JSON:\n${JSON.stringify(goalCtx)}`,
                unique.length > 1
                  ? 'Image 1=original, Image 2=preprocess. Estimate nutrition with fieldConfidence + assumptions.'
                  : 'Estimate nutrition with fieldConfidence + assumptions.',
              ]
                .filter(Boolean)
                .join('\n\n'),
            },
            ...imageContent,
          ],
        },
      ],
    })

    for (const item of pass2.output) {
      if (item.type !== 'message') continue
      for (const part of item.content) {
        if (part.type === 'refusal') {
          return res.status(422).json({ error: part.refusal, refused: true })
        }
      }
    }

    const raw = pass2.output_text
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
      items: Array<{ name: string; grams: number; calories: number }>
      visible_text: string
      image_quality: 'low' | 'medium' | 'high'
      portion_note: string
      portionBasis: string
      assumptions: string[]
      fieldConfidence: {
        food: number
        grams: number
        calories: number
        protein: number
        fat: number
        carbs: number
      }
      goalImpact: { verdict: 'help' | 'caution' | 'neutral'; message: string }
    }

    const fc = parsed.fieldConfidence
    return res.status(200).json({
      food: parsed.food,
      grams: Math.round(parsed.grams),
      calories: Math.round(parsed.calories),
      protein: Math.round(parsed.protein * 10) / 10,
      fat: Math.round(parsed.fat * 10) / 10,
      carbs: Math.round(parsed.carbs * 10) / 10,
      confidence: clamp01(parsed.confidence),
      ingredients: parsed.ingredients?.slice(0, 10) ?? [],
      tip: parsed.tip || '',
      is_unclear: Boolean(parsed.is_unclear),
      items: (parsed.items ?? []).slice(0, 8).map((it) => ({
        name: it.name,
        grams: Math.round(it.grams),
        calories: Math.round(it.calories),
      })),
      visible_text: parsed.visible_text || '',
      image_quality: parsed.image_quality || 'medium',
      portion_note: parsed.portion_note || '',
      portionBasis: parsed.portionBasis || '',
      assumptions: (parsed.assumptions ?? []).slice(0, 6),
      fieldConfidence: {
        food: clamp01(fc?.food ?? parsed.confidence),
        grams: clamp01(fc?.grams ?? parsed.confidence),
        calories: clamp01(fc?.calories ?? parsed.confidence),
        protein: clamp01(fc?.protein ?? parsed.confidence),
        fat: clamp01(fc?.fat ?? parsed.confidence),
        carbs: clamp01(fc?.carbs ?? parsed.confidence),
      },
      goalImpact: parsed.goalImpact ?? { verdict: 'neutral', message: '' },
      detail,
      image_count: unique.length,
      model,
      twoPass,
      usage: pass2.usage ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Vision analysis failed'
    console.error('[api/vision]', message)
    return res.status(500).json({ error: message })
  }
}
