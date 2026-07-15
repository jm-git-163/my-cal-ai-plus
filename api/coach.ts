import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getModel, getOpenAI } from '../lib/openai'

const coachSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    advice: { type: 'string' },
    focus: {
      type: 'array',
      items: { type: 'string' },
    },
    score: { type: 'number' },
    predicted_goal_note: { type: 'string' },
  },
  required: ['summary', 'advice', 'focus', 'score', 'predicted_goal_note'],
  additionalProperties: false,
} as const

interface MealInput {
  food?: string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  mealType?: string
  createdAt?: string
}

/**
 * AI Coach via Responses API + Structured Outputs.
 * @see https://developers.openai.com/api/docs
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body as {
      meals?: MealInput[]
      goals?: {
        calories?: number
        protein?: number
        carbs?: number
        fat?: number
      }
      locale?: string
      name?: string
    }

    const meals = Array.isArray(body.meals) ? body.meals.slice(0, 40) : []
    const goals = body.goals ?? {}
    const lang = body.locale === 'en' ? 'English' : 'Korean'
    const name = body.name || 'User'

    const client = getOpenAI()
    const model = getModel()

    const payload = {
      name,
      goals,
      meal_count: meals.length,
      meals: meals.map((m) => ({
        food: m.food,
        mealType: m.mealType,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        createdAt: m.createdAt,
      })),
    }

    const response = await client.responses.create({
      model,
      instructions: `You are My Cal AI Plus nutrition coach.
Analyze recent meals vs daily goals and coach with practical next actions.
Write summary (1 sentence), advice (~100 chars actionable tip), focus (2-4 short tags), score 0-100 (nutrition quality vs goals), predicted_goal_note (one encouraging progress note).
All user-facing strings in ${lang}.
If meals are empty, coach on getting started with food scanning.`,
      text: {
        format: {
          type: 'json_schema',
          name: 'ai_coach',
          strict: true,
          schema: coachSchema,
        },
      },
      input: `Coach this user from the JSON data:\n${JSON.stringify(payload)}`,
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
      summary: string
      advice: string
      focus: string[]
      score: number
      predicted_goal_note: string
    }

    return res.status(200).json({
      summary: parsed.summary,
      advice: parsed.advice,
      focus: parsed.focus?.slice(0, 4) ?? [],
      score: Math.min(100, Math.max(0, Math.round(parsed.score))),
      predicted_goal_note: parsed.predicted_goal_note,
      model,
      usage: response.usage ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Coach analysis failed'
    console.error('[api/coach]', message)
    return res.status(500).json({ error: message })
  }
}
