import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getFastModel, getFastReasoningEffort, getOpenAI } from '../lib/openai.js'

const OPTION_KINDS = ['meal', 'snack', 'hydrate', 'rest'] as const

const recommendSchema = {
  type: 'object',
  properties: {
    meal_slot: { type: 'string' },
    situation_note: { type: 'string' },
    remaining_note: { type: 'string' },
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: [...OPTION_KINDS] },
          title: { type: 'string' },
          calories: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['kind', 'title', 'calories', 'protein', 'carbs', 'fat', 'reason'],
        additionalProperties: false,
      },
    },
    tip: { type: 'string' },
  },
  required: ['meal_slot', 'situation_note', 'remaining_note', 'options', 'tip'],
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

function isSameDay(iso?: string, now = new Date()) {
  if (!iso) return false
  const d = new Date(iso)
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function timeOfDay(hour: number): 'early_morning' | 'morning' | 'lunch' | 'afternoon' | 'evening' | 'late_night' {
  if (hour < 6) return 'early_morning'
  if (hour < 10) return 'morning'
  if (hour < 14) return 'lunch'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'late_night'
}

function guessMealSlot(hour: number) {
  if (hour < 10) return 'Breakfast'
  if (hour < 15) return 'Lunch'
  if (hour < 21) return 'Dinner'
  return 'Snack'
}

function weightMode(current?: number, goal?: number): 'lose' | 'gain' | 'maintain' {
  if (!current || !goal) return 'maintain'
  const diff = goal - current
  if (diff < -0.5) return 'lose'
  if (diff > 0.5) return 'gain'
  return 'maintain'
}

function minutesSinceLastMeal(meals: MealInput[], now: Date): number | null {
  const times = meals
    .map((m) => (m.createdAt ? new Date(m.createdAt).getTime() : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a)
  if (times.length === 0) return null
  return Math.max(0, Math.round((now.getTime() - times[0]) / 60000))
}

/**
 * Context-aware next-meal / hydrate / rest recommendations.
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
        waterMl?: number
      }
      locale?: string
      name?: string
      currentWeightKg?: number
      goalWeightKg?: number
      mealSlot?: string
      localHour?: number
      nowIso?: string
    }

    const now = body.nowIso ? new Date(body.nowIso) : new Date()
    const hour =
      typeof body.localHour === 'number' && body.localHour >= 0 && body.localHour <= 23
        ? Math.floor(body.localHour)
        : now.getHours()

    const allMeals = Array.isArray(body.meals) ? body.meals.slice(0, 40) : []
    const todayMeals = allMeals.filter((m) => isSameDay(m.createdAt, now))
    const goals = {
      calories: Number(body.goals?.calories) || 2000,
      protein: Number(body.goals?.protein) || 120,
      carbs: Number(body.goals?.carbs) || 220,
      fat: Number(body.goals?.fat) || 65,
      waterMl: Number(body.goals?.waterMl) || 2000,
    }
    const lang = body.locale === 'en' ? 'English' : 'Korean'
    const name = body.name || 'User'
    const mode = weightMode(body.currentWeightKg, body.goalWeightKg)
    const mealSlot = body.mealSlot || guessMealSlot(hour)
    const tod = timeOfDay(hour)
    const minsSince = minutesSinceLastMeal(todayMeals, now)

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

    const overCalories = remaining.calories <= 0
    const lowRemaining = remaining.calories > 0 && remaining.calories < 250
    const justAte = minsSince !== null && minsSince < 90
    const lateNight = tod === 'late_night' || tod === 'early_morning'

    const payload = {
      name,
      local_hour: hour,
      time_of_day: tod,
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
      context_flags: {
        over_calories: overCalories,
        low_remaining_calories: lowRemaining,
        just_ate_within_90min: justAte,
        late_night: lateNight,
        minutes_since_last_meal: minsSince,
      },
      recent_meals: todayMeals.slice(0, 8).map((m) => ({
        food: m.food,
        mealType: m.mealType,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        createdAt: m.createdAt,
      })),
    }

    const client = getOpenAI()
    const model = getFastModel()
    const reasoningEffort = getFastReasoningEffort()

    const response = await client.responses.create({
      model,
      reasoning: { effort: reasoningEffort },
      instructions: `You are My Cal AI Plus meal coach.
Recommend what to do NEXT based on clock time, remaining macros, weight goal, and recent eating.
Be concise. All user-facing strings must be in ${lang}.

Output fields:
- meal_slot: localized time slot label
- situation_note: 1 friendly sentence (time + goal + remaining)
- remaining_note: short leftover kcal/protein line
- options: 2 or 3 items with kind, title, macros, reason
- tip: one gentle tip

Decision rules:
1) If over_calories OR (late_night AND remaining calories < 350) OR (just_ate_within_90min AND remaining calories < 400):
   - Put hydrate or rest FIRST. Optional 1 light snack; no heavy meal.
2) If low_remaining_calories (<250): hydrate + light snack; avoid large meals.
3) High protein remaining + calories left → protein-forward option for meal_slot.
4) weight_goal_mode lose → water/volume/protein; gain → fuller meals within remaining; maintain → balanced.
5) Match meal_slot / local_hour. Late night → light or hydrate.
6) Korean → everyday Korean options; English → practical familiar options.
7) hydrate/rest macros ≈ 0.
8) Never shaming. Always 2 or 3 options.`,
      text: {
        format: {
          type: 'json_schema',
          name: 'meal_recommend',
          strict: true,
          schema: recommendSchema,
        },
      },
      input: `Recommend the next action/meal from this JSON:\n${JSON.stringify(payload)}`,
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
      situation_note: string
      remaining_note: string
      options: Array<{
        kind: string
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
      .map((o) => {
        const kind = OPTION_KINDS.includes(o.kind as (typeof OPTION_KINDS)[number])
          ? (o.kind as (typeof OPTION_KINDS)[number])
          : 'meal'
        const isNonFood = kind === 'hydrate' || kind === 'rest'
        return {
          kind,
          title: o.title,
          calories: isNonFood ? 0 : Math.max(0, Math.round(o.calories)),
          protein: isNonFood ? 0 : Math.max(0, Math.round(o.protein * 10) / 10),
          carbs: isNonFood ? 0 : Math.max(0, Math.round(o.carbs * 10) / 10),
          fat: isNonFood ? 0 : Math.max(0, Math.round(o.fat * 10) / 10),
          reason: o.reason,
        }
      })

    if (options.length < 2) {
      return res.status(502).json({ error: 'Not enough recommendation options returned' })
    }

    return res.status(200).json({
      meal_slot: parsed.meal_slot,
      situation_note: parsed.situation_note,
      remaining_note: parsed.remaining_note,
      options,
      tip: parsed.tip,
      remaining,
      context: {
        local_hour: hour,
        time_of_day: tod,
        over_calories: overCalories,
        just_ate: justAte,
        late_night: lateNight,
      },
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
