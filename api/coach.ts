import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getModel, getOpenAI } from '../lib/openai.js'

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
    weight_trend: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['lose', 'gain', 'maintain'] },
        estimate_4w: { type: 'string' },
        explanation: { type: 'string' },
      },
      required: ['direction', 'estimate_4w', 'explanation'],
      additionalProperties: false,
    },
    muscle_trend: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['increase', 'decrease', 'maintain'] },
        estimate_4w: { type: 'string' },
        explanation: { type: 'string' },
      },
      required: ['direction', 'estimate_4w', 'explanation'],
      additionalProperties: false,
    },
    energy_trend: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['up', 'down', 'stable'] },
        explanation: { type: 'string' },
      },
      required: ['direction', 'explanation'],
      additionalProperties: false,
    },
    outlook_2w: { type: 'string' },
    outlook_4w: { type: 'string' },
    outlook_8w: { type: 'string' },
    disclaimer: { type: 'string' },
  },
  required: [
    'summary',
    'advice',
    'focus',
    'score',
    'predicted_goal_note',
    'weight_trend',
    'muscle_trend',
    'energy_trend',
    'outlook_2w',
    'outlook_4w',
    'outlook_8w',
    'disclaimer',
  ],
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

function buildTrendStats(meals: MealInput[]) {
  const byDay = new Map<string, { cal: number; protein: number; carbs: number; fat: number; count: number }>()
  for (const m of meals) {
    const day = (m.createdAt ? new Date(m.createdAt) : new Date()).toISOString().slice(0, 10)
    const cur = byDay.get(day) ?? { cal: 0, protein: 0, carbs: 0, fat: 0, count: 0 }
    cur.cal += Number(m.calories) || 0
    cur.protein += Number(m.protein) || 0
    cur.carbs += Number(m.carbs) || 0
    cur.fat += Number(m.fat) || 0
    cur.count += 1
    byDay.set(day, cur)
  }

  const days = [...byDay.values()]
  const n = days.length || 1
  const avg = {
    days_logged: days.length,
    avg_daily_calories: Math.round(days.reduce((s, d) => s + d.cal, 0) / n),
    avg_daily_protein: Math.round((days.reduce((s, d) => s + d.protein, 0) / n) * 10) / 10,
    avg_daily_carbs: Math.round((days.reduce((s, d) => s + d.carbs, 0) / n) * 10) / 10,
    avg_daily_fat: Math.round((days.reduce((s, d) => s + d.fat, 0) / n) * 10) / 10,
  }
  return avg
}

/**
 * AI Coach via Responses API + Structured Outputs.
 * Includes body-composition trend outlook if current eating continues.
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
        exerciseMin?: number
      }
      locale?: string
      name?: string
    }

    const meals = Array.isArray(body.meals) ? body.meals.slice(0, 40) : []
    const goals = body.goals ?? {}
    const lang = body.locale === 'en' ? 'English' : 'Korean'
    const name = body.name || 'User'
    const trend = buildTrendStats(meals)

    const client = getOpenAI()
    const model = getModel()

    const calorieGap =
      goals.calories && trend.days_logged > 0 ? trend.avg_daily_calories - goals.calories : null
    const proteinGap =
      goals.protein && trend.days_logged > 0 ? trend.avg_daily_protein - goals.protein : null

    const payload = {
      name,
      goals,
      trend,
      calorie_gap_vs_goal: calorieGap,
      protein_gap_vs_goal: proteinGap,
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
      instructions: `You are My Cal AI Plus fitness & nutrition coach.
Analyze logged meals vs daily goals and project what happens IF the user continues this eating pattern.

Output requirements (all user-facing strings in ${lang}):
- summary: 1 sentence snapshot
- advice: ~100 chars actionable tip
- focus: 2-4 short tags
- score: 0-100 nutrition quality vs goals
- predicted_goal_note: encouraging progress note
- weight_trend: direction lose|gain|maintain, estimate_4w (e.g. "-0.8~-1.2 kg / 4 weeks" or English equivalent), explanation
- muscle_trend: direction increase|decrease|maintain (protein + surplus/deficit based strength/muscle capacity outlook), estimate_4w, explanation
- energy_trend: direction up|down|stable, explanation
- outlook_2w / outlook_4w / outlook_8w: concise what-if projections for 2/4/8 weeks if trend continues
- disclaimer: short note that this is an estimate, not medical advice, individuals vary

Rules:
- Use trend.avg_daily_calories vs goals.calories for weight bias (~7700 kcal ≈ 1 kg as rough heuristic; keep ranges, not false precision).
- Use protein vs goals.protein and calorie balance for muscle outlook (protein surplus without stimulus ≠ guaranteed muscle; say "capacity" language).
- If meals empty or days_logged < 2, be conservative, lower confidence in tone, and coach starting habits.
- Do NOT claim guaranteed body changes.`,
      text: {
        format: {
          type: 'json_schema',
          name: 'ai_coach',
          strict: true,
          schema: coachSchema,
        },
      },
      input: `Coach and project body trends from this JSON:\n${JSON.stringify(payload)}`,
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
      weight_trend: { direction: string; estimate_4w: string; explanation: string }
      muscle_trend: { direction: string; estimate_4w: string; explanation: string }
      energy_trend: { direction: string; explanation: string }
      outlook_2w: string
      outlook_4w: string
      outlook_8w: string
      disclaimer: string
    }

    return res.status(200).json({
      summary: parsed.summary,
      advice: parsed.advice,
      focus: parsed.focus?.slice(0, 4) ?? [],
      score: Math.min(100, Math.max(0, Math.round(parsed.score))),
      predicted_goal_note: parsed.predicted_goal_note,
      weight_trend: parsed.weight_trend,
      muscle_trend: parsed.muscle_trend,
      energy_trend: parsed.energy_trend,
      outlook_2w: parsed.outlook_2w,
      outlook_4w: parsed.outlook_4w,
      outlook_8w: parsed.outlook_8w,
      disclaimer: parsed.disclaimer,
      stats: trend,
      model,
      usage: response.usage ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Coach analysis failed'
    console.error('[api/coach]', message)
    return res.status(500).json({ error: message })
  }
}
