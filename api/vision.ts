import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getModel, getOpenAI } from '../lib/openai.js'

export type VisionDetail = 'low' | 'high' | 'original' | 'auto'

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])

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
  // Docs: high = standard high-fidelity; original/auto on GPT-5.6 can raise token cost
  return 'high'
}

/**
 * Food vision via Responses API.
 * Follows https://developers.openai.com/api/docs/guides/images-vision#analyze-images
 * - Base64 data URL input
 * - Multi-image content (original + CNN preprocess)
 * - detail: low | high | original | auto
 * - MIME validation (png/jpeg/webp/gif)
 */
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
    }

    const detail = normalizeDetail(body.detail)
    const lang = body.locale === 'en' ? 'English' : 'Korean'

    const candidates = [
      ...(Array.isArray(body.images) ? body.images : []),
      ...(typeof body.image === 'string' ? [body.image] : []),
    ].filter((u): u is string => typeof u === 'string' && u.length > 0)

    // Deduplicate while keeping order; max 2 images (original + preprocess)
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
      if (!parsed || !ALLOWED_MIME.has(parsed.mime === 'image/jpg' ? 'image/jpeg' : parsed.mime)) {
        return res.status(400).json({
          error: 'Unsupported image type. Use PNG, JPEG, WEBP, or non-animated GIF.',
        })
      }
      // Keep payload practical for serverless (docs allow up to 50MB+; we stay lean)
      if (url.length > 5_500_000) {
        return res.status(413).json({ error: 'Image too large. Please use a smaller photo.' })
      }
    }

    const client = getOpenAI()
    const model = getModel()

    const content: Array<
      | { type: 'input_text'; text: string }
      | { type: 'input_image'; image_url: string; detail: VisionDetail }
    > = [
      {
        type: 'input_text',
        text:
          unique.length > 1
            ? 'Image 1 = original meal photo. Image 2 = CNN-style preprocessed (contrast/edge) version of the same plate. Use both views to identify foods and estimate nutrition. Prefer visible evidence; if they conflict, trust Image 1 for color/texture and Image 2 for boundaries.'
            : 'Analyze this meal photo and return structured nutrition estimates.',
      },
      ...unique.map((image_url) => ({
        type: 'input_image' as const,
        image_url,
        detail,
      })),
    ]

    const response = await client.responses.create({
      model,
      instructions: `You are a nutrition vision expert for My Cal AI Plus.
Use vision carefully per OpenAI image-analysis guidance:
- Object counts and portion sizes are approximate; state uncertainty in portion_note.
- Read any readable labels/menu text into visible_text (empty string if none). Non-Latin text may be imperfect.
- If the photo looks rotated, still identify the upright meal content.
- Do NOT give medical advice. tip must be general nutrition guidance only.
- If image is not food, NSFW-unclear, panoramic/fisheye-distorted, or too blurry, set is_unclear=true and lower confidence.
- For multi-food plates, list each major item in "items" and set food to a short plate summary.
- image_quality: low|medium|high based on lighting/blur/occlusion.
Estimate dish name, total grams, calories, macros (protein/fat/carbs g). confidence 0–1.
ingredients: short visible/main ingredients.
tip: one practical tip (~80 chars) in ${lang}.
All user-facing strings (food, tip, portion_note, item names) in ${lang}.`,
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
          content,
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
      items: Array<{ name: string; grams: number; calories: number }>
      visible_text: string
      image_quality: 'low' | 'medium' | 'high'
      portion_note: string
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
      items: (parsed.items ?? []).slice(0, 8).map((it) => ({
        name: it.name,
        grams: Math.round(it.grams),
        calories: Math.round(it.calories),
      })),
      visible_text: parsed.visible_text || '',
      image_quality: parsed.image_quality || 'medium',
      portion_note: parsed.portion_note || '',
      detail,
      image_count: unique.length,
      model,
      usage: response.usage ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Vision analysis failed'
    console.error('[api/vision]', message)
    return res.status(500).json({ error: message })
  }
}
