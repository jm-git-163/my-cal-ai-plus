import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getFastModel,
  getFastReasoningEffort,
  getOpenAI,
  supportsReasoningEffort,
} from '../lib/openai.js'

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

type DayBucket = {
  cal: number
  protein: number
  carbs: number
  fat: number
  count: number
  types: Set<string>
}

function normalizeMealType(raw?: string): string {
  const t = (raw || '').toLowerCase()
  if (t.includes('break') || t.includes('아침')) return 'breakfast'
  if (t.includes('lunch') || t.includes('점심')) return 'lunch'
  if (t.includes('dinner') || t.includes('저녁')) return 'dinner'
  if (t.includes('snack') || t.includes('간식')) return 'snack'
  return t || 'other'
}

/** A day is "complete enough" for daily-intake averaging / weight projection. */
function isDayComplete(day: DayBucket, goalCalories: number): boolean {
  const mains = ['breakfast', 'lunch', 'dinner'].filter((t) => day.types.has(t)).length
  if (mains >= 2) return true
  if (day.count >= 3) return true
  if (goalCalories > 0 && day.cal >= goalCalories * 0.7) return true
  return false
}

/**
 * Build intake stats with honesty about partial days.
 * avg_logged_* = only what was recorded (can look tiny if one meal).
 * projected_daily_* = basis for weight math (complete days only, or null).
 */
function buildTrendStats(meals: MealInput[], goalCalories: number, goalProtein: number) {
  const byDay = new Map<string, DayBucket>()
  for (const m of meals) {
    const day = (m.createdAt ? new Date(m.createdAt) : new Date()).toISOString().slice(0, 10)
    const cur = byDay.get(day) ?? {
      cal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      count: 0,
      types: new Set<string>(),
    }
    cur.cal += Number(m.calories) || 0
    cur.protein += Number(m.protein) || 0
    cur.carbs += Number(m.carbs) || 0
    cur.fat += Number(m.fat) || 0
    cur.count += 1
    cur.types.add(normalizeMealType(m.mealType))
    byDay.set(day, cur)
  }

  const days = [...byDay.values()]
  const daysLogged = days.length
  const mealCount = meals.length
  const avgMealsPerDay =
    daysLogged > 0 ? Math.round((mealCount / daysLogged) * 10) / 10 : 0

  const loggedAvg =
    daysLogged > 0
      ? {
          calories: Math.round(days.reduce((s, d) => s + d.cal, 0) / daysLogged),
          protein: Math.round((days.reduce((s, d) => s + d.protein, 0) / daysLogged) * 10) / 10,
          carbs: Math.round((days.reduce((s, d) => s + d.carbs, 0) / daysLogged) * 10) / 10,
          fat: Math.round((days.reduce((s, d) => s + d.fat, 0) / daysLogged) * 10) / 10,
        }
      : { calories: 0, protein: 0, carbs: 0, fat: 0 }

  const completeDays = days.filter((d) => isDayComplete(d, goalCalories))
  const completeCount = completeDays.length

  let projectedDailyCalories: number | null = null
  let projectedDailyProtein: number | null = null
  let projectionBasis: 'complete_days' | 'insufficient' = 'insufficient'

  if (completeCount >= 1) {
    projectedDailyCalories = Math.round(
      completeDays.reduce((s, d) => s + d.cal, 0) / completeCount,
    )
    projectedDailyProtein =
      Math.round((completeDays.reduce((s, d) => s + d.protein, 0) / completeCount) * 10) / 10
    projectionBasis = 'complete_days'
  }

  const incompleteLogging =
    daysLogged === 0 ||
    completeCount === 0 ||
    (goalCalories > 0 && loggedAvg.calories < goalCalories * 0.55 && avgMealsPerDay < 2.5)

  /** high: 3+ complete days; medium: 1–2 complete; low: only partial logs */
  let confidence: 'low' | 'medium' | 'high' = 'low'
  if (completeCount >= 3) confidence = 'high'
  else if (completeCount >= 1) confidence = 'medium'

  const projectionUsable = projectionBasis === 'complete_days' && projectedDailyCalories !== null

  // Soft coverage hint for the model (not used for weight math when incomplete).
  const coverageRatio =
    goalCalories > 0
      ? Math.min(1, Math.round((loggedAvg.calories / goalCalories) * 100) / 100)
      : Math.min(1, avgMealsPerDay / 3)

  return {
    days_logged: daysLogged,
    complete_days: completeCount,
    meal_count: mealCount,
    avg_meals_per_day: avgMealsPerDay,
    // Raw logged averages (can be one breakfast only — DO NOT treat as full-day intake)
    avg_daily_calories: loggedAvg.calories,
    avg_daily_protein: loggedAvg.protein,
    avg_daily_carbs: loggedAvg.carbs,
    avg_daily_fat: loggedAvg.fat,
    // Honest projection inputs
    projected_daily_calories: projectedDailyCalories,
    projected_daily_protein: projectedDailyProtein,
    projection_basis: projectionBasis,
    projection_usable: projectionUsable,
    incomplete_logging: incompleteLogging,
    coverage_ratio_vs_goal: coverageRatio,
    confidence,
    goal_calories: goalCalories || null,
    goal_protein: goalProtein || null,
  }
}

function enforceLowConfidenceTrends(
  parsed: {
    weight_trend: { direction: string; estimate_4w: string; explanation: string }
    muscle_trend: { direction: string; estimate_4w: string; explanation: string }
    energy_trend: { direction: string; explanation: string }
    outlook_2w: string
    outlook_4w: string
    outlook_8w: string
    predicted_goal_note: string
    disclaimer: string
  },
  lang: string,
) {
  const ko = lang === 'Korean'
  return {
    ...parsed,
    weight_trend: {
      direction: 'maintain',
      estimate_4w: ko ? '기록 더 필요' : 'Need more logs',
      explanation: ko
        ? '아침·점심 등 일부만 있으면 하루 섭취로 보지 않아요. 하루 2끼 이상(또는 목표의 70%+)이 쌓이면 체중 전망을 냅니다.'
        : 'Partial logs (e.g. breakfast only) are not treated as a full day’s intake. Add 2+ meals/day (or ~70%+ of your calorie goal) for a weight outlook.',
    },
    muscle_trend: {
      direction: 'maintain',
      estimate_4w: ko ? '기록 더 필요' : 'Need more logs',
      explanation: ko
        ? '단백질 추정도 하루 기록이 더 채워진 뒤가 정확해요.'
        : 'Protein trend is more reliable after fuller daily logs.',
    },
    energy_trend: {
      direction: 'stable',
      explanation: ko
        ? '지금은 기록된 끼니 품질만 참고하고, 하루 전체 전망은 보류해요.'
        : 'For now we only note logged meals — full-day energy outlook waits for better coverage.',
    },
    outlook_2w: ko
      ? '며칠간 아침·점심·저녁을 이어서 기록해 보면 2주 전망이 선명해져요.'
      : 'Log fuller days for a clearer 2-week outlook.',
    outlook_4w: ko
      ? '하루 기록이 충분히 쌓이면 4주 체중·근력 전망을 다시 계산해요.'
      : 'We’ll recalculate the 4-week outlook once daily coverage improves.',
    outlook_8w: ko
      ? '꾸준히 기록할수록 8주 추정이 현실에 가까워집니다.'
      : 'Steady logging makes the 8-week estimate more realistic.',
    predicted_goal_note: ko
      ? '지금은 일부 끼니만 보여요. 하루를 더 채우면 목표가 눈에 보여요.'
      : 'Only part of the day is logged — fill in more meals for a clearer goal path.',
    disclaimer: ko
      ? '일부 끼니만 기록된 상태의 추정입니다. 하루·며칠 기록이 쌓이면 신뢰도가 올라갑니다. 의료 조언이 아닙니다.'
      : 'Estimate based on partial meal logs. Reliability rises with fuller days. Not medical advice.',
  }
}

/**
 * AI Coach via Responses API + Structured Outputs.
 * Weight outlook uses complete-day intake only — never “one meal × meals/day”.
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
      currentWeightKg?: number
      goalWeightKg?: number
    }

    const meals = Array.isArray(body.meals) ? body.meals.slice(0, 40) : []
    const goals = body.goals ?? {}
    const lang = body.locale === 'en' ? 'English' : 'Korean'
    const name = body.name || 'User'
    const goalCalories = Number(goals.calories) || 0
    const goalProtein = Number(goals.protein) || 0
    const trend = buildTrendStats(meals, goalCalories, goalProtein)
    const currentWeightKg = body.currentWeightKg
    const goalWeightKg = body.goalWeightKg

    const client = getOpenAI()
    const model = getFastModel()

    const calorieGap =
      trend.projection_usable && goalCalories && trend.projected_daily_calories != null
        ? trend.projected_daily_calories - goalCalories
        : null
    const proteinGap =
      trend.projection_usable && goalProtein && trend.projected_daily_protein != null
        ? trend.projected_daily_protein - goalProtein
        : null

    const payload = {
      name,
      goals,
      currentWeightKg: currentWeightKg ?? null,
      goalWeightKg: goalWeightKg ?? null,
      trend,
      calorie_gap_vs_goal: calorieGap,
      protein_gap_vs_goal: proteinGap,
      meal_count: meals.length,
      meals: meals.map((m) => ({
        f: String(m.food || '').slice(0, 48),
        t: m.mealType,
        c: Math.round(Number(m.calories) || 0),
        p: Math.round((Number(m.protein) || 0) * 10) / 10,
        cb: Math.round((Number(m.carbs) || 0) * 10) / 10,
        ft: Math.round((Number(m.fat) || 0) * 10) / 10,
        d: m.createdAt ? m.createdAt.slice(0, 10) : undefined,
      })),
    }

    const response = await client.responses.create({
      model,
      ...(supportsReasoningEffort(model)
        ? { reasoning: { effort: getFastReasoningEffort() } }
        : {}),
      instructions: `My Cal AI Plus coach. Be honest about incomplete logs.
User strings in ${lang}. Be terse.

CRITICAL — how calories work:
- avg_daily_calories = sum of LOGGED meals that day ÷ days. If only breakfast (e.g. 485 kcal) was logged, this number is ~485 — NOT a full day, NOT “per-meal × 3”.
- NEVER multiply one meal by 2–3 to invent a daily total.
- For weight change (~7700 kcal ≈ 1 kg), ONLY use projected_daily_calories when projection_usable=true (based on complete days: 2+ main meals, or ≥3 logs, or ≥70% of calorie goal).
- If projection_usable=false OR confidence=low OR incomplete_logging=true:
  - weight/muscle estimate_4w must say more logging is needed (not a big kg change).
  - direction: maintain (weight/muscle); energy: stable.
  - Do NOT claim large fat loss from a single small meal day.
- Score (0–100): judge logged meals vs goals fairly; partial days can still score meal quality, but keep score moderate if coverage is low.
- predicted_goal_note: encourage fuller daily logging when incomplete.

Fields: summary, advice≤100chars, focus 2-4 tags, score, predicted_goal_note,
weight_trend, muscle_trend, energy_trend, outlook_2w/4w/8w, disclaimer.
Meal keys: f=food t=type c=kcal p/cb/ft=macros d=YYYY-MM-DD.`,
      text: {
        format: {
          type: 'json_schema',
          name: 'ai_coach',
          strict: true,
          schema: coachSchema,
        },
      },
      input: `Coach from JSON:\n${JSON.stringify(payload)}`,
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

    let parsed = JSON.parse(raw) as {
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

    // Hard safety net — never let the model invent crash diets from one breakfast.
    if (!trend.projection_usable || trend.confidence === 'low') {
      parsed = enforceLowConfidenceTrends(parsed, lang)
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
      stats: {
        days_logged: trend.days_logged,
        avg_daily_calories: trend.avg_daily_calories,
        avg_daily_protein: trend.avg_daily_protein,
        avg_daily_carbs: trend.avg_daily_carbs,
        avg_daily_fat: trend.avg_daily_fat,
        complete_days: trend.complete_days,
        projected_daily_calories: trend.projected_daily_calories,
        confidence: trend.confidence,
        projection_usable: trend.projection_usable,
        incomplete_logging: trend.incomplete_logging,
      },
      model,
      usage: response.usage ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Coach analysis failed'
    console.error('[api/coach]', message)
    return res.status(500).json({ error: message })
  }
}
