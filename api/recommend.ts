import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getModel, getOpenAI } from '../lib/openai.js'

const recommendSchema = {
  type: 'object',
  properties: {
    meal_slot: { type: 'string' },
    remaining_note: { type: 'string' },
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          calories: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['title', 'calories', 'protein', 'carbs', 'fat', 'reason'],
        additionalProperties: false,
      },
    },
    tip: { type: 'string' },
  },
  required: ['meal_slot', 'remaining_note', 'options', 'tip'],
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

function isSameDay(iso?: string, date = new Date()) {
  if (!iso) return false
  const d = new Date(iso)
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  )
}

function guessMealSlot(date = new Date()) {
  const h = date.getHours()
  if (h < 10) return 'Breakfast'
  if (h < 15) return 'Lunch'
  if (h < 21) return 'Dinner'
  return 'Snack'
}

function weightMode(current?: number, goal?: number): 'lose' | 'gain' | 'maintain' {
  if (!current || !goal) return 'maintain'
  const diff = goal - current
  if (diff < -0.5) return 'lose'
  if (diff > 0.5) return 'gain'
  return 'maintain'
}

/**
 * Next-meal recommendations from remaining macros + weight goal.
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
      currentWeightKg?: number
      goalWeightKg?: number
      mealSlot?: string
    }

    const allMeals = Array.isArray(body.meals) ? body.meals.slice(0, 40) : []
    const todayMeals = allMeals.filter((m) => isSameDay(m.createdAt))
    const goals = {
      calories: Number(body.goals?.calories) || 2000,
      protein: Number(body.goals?.protein) || 120,
      carbs: Number(body.goals?.carbs) || 220,
      fat: Number(body.goals?.fat) || 65,
    }
    const lang = body.locale === 'en' ? 'English' : 'Korean'
    const name = body.name || 'User'
    const mode = weightMode(body.currentWeightKg, body.goalWeightKg)
    const mealSlot = body.mealSlot || guessMealSlot()

    const eaten = todayMeals.reduce(
      (acc, m) => ({
        calories: acc.calories + (Number(m.calories) || 0),
        protein: acc.protein + (Number(m.protein) || 0),
        carbs: acc.carbs + (Number(m.carbs) || 0),
        fat: acc.fat + (Number(m.fat) || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    )

    const remaining = {
      calories: Math.round(goals.calories - eaten.calories),
      protein: Math.round((goals.protein - eaten.protein) * 10) / 10,
      carbs: Math.round((goals.carbs - eaten.carbs) * 10) / 10,
      fat: Math.round((goals.fat - eaten.fat) * 10) / 10,
    }

    const payload = {
      name,
      meal_slot: mealSlot,
      weight_goal_mode: mode,
      currentWeightKg: body.currentWeightKg ?? null,
      goalWeightKg: body.goalWeightKg ?? null,
      daily_goals: goals,
      eaten_today: {
        calories: Math.round(eaten.calories),
        protein: Math.round(eaten.protein * 10) / 10,
        carbs: Math.round(eaten.carbs * 10) / 10,
        fat: Math.round(eaten.fat * 10) / 10,
        meal_count: todayMeals.length,
      },
      remaining_today: remaining,
      recent_meals: todayMeals.slice(0, 8).map((m) => ({
        food: m.food,
        mealType: m.mealType,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
      })),
    }

    const client = getOpenAI()
    const model = getModel()

    const response = await client.responses.create({
      model,
      instructions: `You are My Cal AI Plus meal coach.
Suggest 2–3 realistic next-meal options that fit remaining daily macros and the user's weight goal.

All user-facing strings must be in ${lang}.

Output:
- meal_slot: e.g. Breakfast / Lunch / Dinner / Snack (localized label OK)
- remaining_note: one short sentence about what is left for today (kcal & protein)
- options: 2 or 3 meals. Each: title (concrete dish people can cook/order), calories, protein, carbs, fat (grams, numbers), reason (one line why it fits remaining macros + weight goal)
- tip: one practical tip (portion, swap, or timing)

Rules:
- Prefer meals whose calories are ~40–90% of remaining calories when remaining calories > 200; if remaining is low (<250) suggest light/high-protein snack or "skip dessert / light broth".
- If protein remaining is high, prioritize protein-forward options.
- weight_goal_mode lose → prefer higher protein, moderate carbs, controlled fat; gain → slightly higher calories within remaining; maintain → balanced.
- Suggest familiar, home-cookable or common Korea/ready options when language is Korean; practical Western options when English.
- Do not invent extreme crash diets. Numbers are approximate estimates only.
- Avoid repeating the exact same food already logged today when possible.
- Always return 2 or 3 options.`,
      text: {
        format: {
          type: 'json_schema',
          name: 'meal_recommend',
          strict: true,
          schema: recommendSchema,
        },
      },
      input: `Recommend the next meal from this JSON:\n${JSON.stringify(payload)}`,
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
      meal_slot: string
      remaining_note: string
      options: Array<{
        title: string
        calories: number
        protein: number
        carbs: number
        fat: number
        reason: string
      }>
      tip: string
    }

    const options = (parsed.options || [])
      .slice(0, 3)
      .map((o) => ({
        title: o.title,
        calories: Math.max(0, Math.round(o.calories)),
        protein: Math.max(0, Math.round(o.protein * 10) / 10),
        carbs: Math.max(0, Math.round(o.carbs * 10) / 10),
        fat: Math.max(0, Math.round(o.fat * 10) / 10),
        reason: o.reason,
      }))

    if (options.length < 2) {
      return res.status(502).json({ error: 'Not enough meal options returned' })
    }

    return res.status(200).json({
      meal_slot: parsed.meal_slot,
      remaining_note: parsed.remaining_note,
      options,
      tip: parsed.tip,
      remaining,
      eaten: {
        calories: Math.round(eaten.calories),
        protein: Math.round(eaten.protein * 10) / 10,
        carbs: Math.round(eaten.carbs * 10) / 10,
        fat: Math.round(eaten.fat * 10) / 10,
      },
      model,
      usage: response.usage ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Meal recommendation failed'
    console.error('[api/recommend]', message)
    return res.status(500).json({ error: message })
  }
}
