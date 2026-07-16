import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getFastModel,
  getFastReasoningEffort,
  getOpenAI,
  supportsReasoningEffort,
} from '../lib/openai.js'
import { absoluteCalorieFloor, shouldPrioritizeNourishment } from '../lib/healthSafety.js'

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

    const allMeals = Array.isArray(body.meals) ? body.meals.slice(0, 24) : []
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
    const recentlyAte = minsSince !== null && minsSince < 150
    const lateNight = tod === 'late_night' || tod === 'early_morning'
    const calorieUsedPct =
      goals.calories > 0 ? Math.round((eaten.calories / goals.calories) * 100) : 0
    const nearGoalCalories =
      remaining.calories > 0 && remaining.calories < Math.max(350, goals.calories * 0.2)
    const safeFloor = absoluteCalorieFloor()
    const needNourish = shouldPrioritizeNourishment({
      eatenCalories: eaten.calories,
      goalCalories: goals.calories,
      eatenProtein: eaten.protein,
      goalProtein: goals.protein,
      mealCount: todayMeals.length,
      safeFloor,
    })
    const proteinStillLow = goals.protein > 0 && eaten.protein < goals.protein * 0.7
    /** Prefer water / skip food — but NEVER when the user is under-fueled. */
    const preferSkipFood =
      !needNourish &&
      (overCalories ||
        (lateNight && remaining.calories < 450 && !proteinStillLow) ||
        (justAte && mode !== 'gain' && !proteinStillLow) ||
        (mode === 'lose' && recentlyAte && nearGoalCalories && !proteinStillLow) ||
        (mode === 'lose' && lowRemaining && eaten.calories >= goals.calories * 0.7) ||
        (tod === 'afternoon' &&
          recentlyAte &&
          remaining.calories < 500 &&
          mode !== 'gain' &&
          !proteinStillLow))

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
        calorie_used_pct: calorieUsedPct,
      },
      remaining_today: remaining,
      context_flags: {
        over_calories: overCalories,
        low_remaining_calories: lowRemaining,
        near_goal_calories: nearGoalCalories,
        just_ate_within_90min: justAte,
        recently_ate_within_150min: recentlyAte,
        late_night: lateNight,
        minutes_since_last_meal: minsSince,
        prefer_skip_food: preferSkipFood,
        prioritize_nourishment: needNourish,
        protein_still_low: proteinStillLow,
        safe_calorie_floor: safeFloor,
      },
      recent_meals: todayMeals.slice(0, 6).map((m) => ({
        f: String(m.food || '').slice(0, 40),
        t: m.mealType,
        c: Math.round(Number(m.calories) || 0),
        p: Math.round((Number(m.protein) || 0) * 10) / 10,
        mins_ago: m.createdAt
          ? Math.max(0, Math.round((now.getTime() - new Date(m.createdAt).getTime()) / 60000))
          : null,
      })),
    }

    const client = getOpenAI()
    const model = getFastModel()

    const response = await client.responses.create({
      model,
      ...(supportsReasoningEffort(model)
        ? { reasoning: { effort: getFastReasoningEffort() } }
        : {}),
      instructions: `You are My Cal AI Plus next-action coach — NOT a menu generator.
Decide whether the user should EAT, SNACK, drink WATER, or do a short NON-FOOD activity.
Be concise. All user-facing strings must be in ${lang}.
Health first: never push fasting when the user is under-fueled or protein-starved.

Output fields:
- meal_slot: localized time slot label (아침/점심/저녁/간식 or Breakfast/…)
- situation_note: 1 honest sentence about NOW
- remaining_note: short leftover kcal/protein line
- options: 2 or 3 items with kind (meal|snack|hydrate|rest), title, macros, reason
- tip: one gentle tip

Core philosophy:
- Sustainable fat loss > skipping meals all day.
- Saying “don’t eat yet” is OK only when prefer_skip_food is true AND prioritize_nourishment is false.
- kind=rest means a concrete activity (walk, stretch, breathing), not “starve”.

Decision rules (follow strictly):
0) If prioritize_nourishment OR protein_still_low with ample remaining calories:
   - FIRST option MUST be kind=meal or kind=snack that is protein-forward (eggs, tofu, chicken, Greek yogurt, fish).
   - Do NOT lead with hydrate/rest. Skipping food is unsafe here.
1) Else if prefer_skip_food OR over_calories OR just_ate_within_90min OR (late_night AND remaining calories < 450):
   - FIRST option MUST be kind=hydrate OR kind=rest.
   - Prefer actionable titles (walk / water+breathing / stretch).
   - At most ONE light snack as alternative; NO full meal as first choice.
2) Else if low_remaining_calories OR near_goal_calories with weight_goal_mode=lose (and protein already OK):
   - Lead with hydrate/rest; optional light snack only if still hungry.
3) Else if real meal_slot AND calories remaining ample AND not just_ate:
   - Normal meal or protein-forward snack first.
4) weight_goal_mode lose → prefer volume + protein, not zero food; gain → fuller meals; maintain → balanced.
5) Late night → hydrate + calm rest unless prioritize_nourishment.
6) hydrate/rest macros ≈0. Never shame.
7) Always return 2 or 3 options.`,
      text: {
        format: {
          type: 'json_schema',
          name: 'meal_recommend',
          strict: true,
          schema: recommendSchema,
        },
      },
      input: `Next action from JSON (meal keys: f=food t=type c=kcal p=protein):\n${JSON.stringify(payload)}`,
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

    // Hard guarantee: when under-fueled, lead with a protein meal — never skip-first.
    if (needNourish || (proteinStillLow && remaining.calories > 250)) {
      const foodFirst = options.find((o) => o.kind === 'meal' || o.kind === 'snack')
      if (foodFirst) {
        const restOpts = options.filter((o) => o !== foodFirst)
        options.splice(0, options.length, foodFirst, ...restOpts)
      } else {
        const ko = lang === 'Korean'
        const needP = Math.max(15, Math.round(remaining.protein))
        options.unshift({
          kind: 'meal',
          title: ko ? '고단백 간단식 (계란·두부·닭가슴살)' : 'Simple high-protein plate (eggs, tofu, chicken)',
          calories: Math.min(450, Math.max(250, Math.round(remaining.calories * 0.35))),
          protein: Math.min(40, Math.max(20, needP)),
          carbs: 20,
          fat: 10,
          reason: ko
            ? '지금은 굶기보다 단백질을 채워 근육·에너지를 지키는 게 감량에도 유리해요.'
            : 'Fuel with protein now — protecting muscle and energy beats skipping meals.',
        })
        while (options.length > 3) options.pop()
      }
    } else if (preferSkipFood) {
      // Hard guarantee: when skip is wiser, lead with water/activity even if the model forgot.
      const skipFirst = options.find((o) => o.kind === 'hydrate' || o.kind === 'rest')
      if (skipFirst) {
        const restOpts = options.filter((o) => o !== skipFirst)
        options.splice(0, options.length, skipFirst, ...restOpts)
      } else {
        const ko = lang === 'Korean'
        const calmHours = lateNight || tod === 'early_morning'
        options.unshift({
          kind: 'rest',
          title: calmHours
            ? ko
              ? '물 한 잔 + 5분 호흡명상'
              : 'Water + 5-min breathing'
            : ko
              ? '물 한 잔 마시고 10분 가벼운 산책'
              : 'Drink water, then a 10-min easy walk',
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          reason: ko
            ? calmHours
              ? '야식 욕구는 조용한 호흡으로 지나가게 두는 편이 목표에 맞아요.'
              : '가벼운 움직임이 허기를 달래 주고, 지금은 간식보다 공복 유지가 맞아요.'
            : calmHours
              ? 'Quiet breathing helps evening hunger pass without another snack.'
              : 'A short walk eases the urge — skipping food fits your goal better now.',
        })
        while (options.length > 3) options.pop()
      }
    }

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
        prefer_skip_food: preferSkipFood,
        prioritize_nourishment: needNourish,
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
