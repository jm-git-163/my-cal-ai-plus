import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getFastModel,
  getFastReasoningEffort,
  getOpenAI,
  supportsReasoningEffort,
} from '../lib/openai.js'
import {
  absoluteCalorieFloor,
  intakeHealthBand,
  proteinAdequacy,
  safeDailyCalorieFloor,
} from '../lib/healthSafety.js'

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
  byType: Record<string, { cal: number; protein: number; count: number }>
}

const MAIN_SLOTS = ['breakfast', 'lunch', 'dinner'] as const
/** Typical share of daily goal when a slot has no history yet. */
const SLOT_GOAL_SHARE: Record<(typeof MAIN_SLOTS)[number], number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.4,
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

function normalizeMealType(raw?: string): string {
  const t = (raw || '').toLowerCase()
  if (t.includes('break') || t.includes('아침')) return 'breakfast'
  if (t.includes('lunch') || t.includes('점심')) return 'lunch'
  if (t.includes('dinner') || t.includes('저녁')) return 'dinner'
  if (t.includes('snack') || t.includes('간식')) return 'snack'
  return t || 'other'
}

function isDayComplete(day: DayBucket, goalCalories: number): boolean {
  const mains = MAIN_SLOTS.filter((t) => day.types.has(t)).length
  if (mains >= 2) return true
  if (day.count >= 3) return true
  if (goalCalories > 0 && day.cal >= goalCalories * 0.7) return true
  return false
}

function weightMode(current?: number, goal?: number): 'lose' | 'gain' | 'maintain' {
  if (!current || !goal) return 'maintain'
  const diff = goal - current
  if (diff < -0.5) return 'lose'
  if (diff > 0.5) return 'gain'
  return 'maintain'
}

/** Muscle outlook must follow protein vs goal — never optimistic when short. */
function enforceMuscleFromProtein<T extends {
  muscle_trend: { direction: string; estimate_4w: string; explanation: string }
  advice: string
  focus: string[]
}>(
  parsed: T,
  proteinG: number,
  goalProtein: number,
  lang: string,
): T {
  if (goalProtein <= 0 || proteinG <= 0) return parsed
  const ko = lang !== 'English'
  const ratio = proteinG / goalProtein
  const gap = Math.round(goalProtein - proteinG)

  if (ratio < 0.85) {
    const tag = ko ? '단백질 보충' : 'More protein'
    const focus = [tag, ...(parsed.focus || [])].filter(
      (v, i, a) => a.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i,
    ).slice(0, 4)
    return {
      ...parsed,
      focus,
      advice: ko
        ? `단백질 목표보다 약 ${gap}g 부족해요. 끼니마다 살코기·계란·두부·그릭요거트를 더 챙기세요.`
        : `About ${gap}g under protein goal — add lean meat, eggs, tofu, or Greek yogurt each meal.`,
      muscle_trend: {
        direction: 'decrease',
        estimate_4w: ko ? '단백질 부족 시 감소 위험' : 'Loss risk if protein stays low',
        explanation: ko
          ? `추정 단백질 약 ${Math.round(proteinG)}g/일(목표 ${goalProtein}g). 이 추세면 근육 유지가 어렵습니다. 단백질을 우선하세요.`
          : `~${Math.round(proteinG)}g protein/day vs ${goalProtein}g goal. This trend risks muscle loss — prioritize protein.`,
      },
    }
  }

  if (ratio < 0.95) {
    return {
      ...parsed,
      muscle_trend: {
        direction: 'maintain',
        estimate_4w: parsed.muscle_trend?.estimate_4w || (ko ? '경계선' : 'Borderline'),
        explanation: ko
          ? `단백질이 목표에 살짝 못 미쳐요(~${Math.round(proteinG)}g/${goalProtein}g). 유지하려면 매 끼 단백질을 조금 더.`
          : `Protein slightly under goal (~${Math.round(proteinG)}g/${goalProtein}g). Add a bit each meal to hold muscle.`,
      },
    }
  }

  // Near/above goal: keep AI text but never claim "increase" on low evidence without surplus.
  if (ratio < 1.05 && parsed.muscle_trend?.direction === 'increase') {
    return {
      ...parsed,
      muscle_trend: {
        ...parsed.muscle_trend,
        direction: 'maintain',
      },
    }
  }

  return parsed
}

/** Never celebrate crash diets — health first, then fat loss. */
function enforceHealthFirst<T extends {
  advice: string
  focus: string[]
  predicted_goal_note: string
  energy_trend: { direction: string; explanation: string }
  weight_trend: { direction: string; estimate_4w: string; explanation: string }
}>(
  parsed: T,
  cal: number,
  pro: number,
  goalCalories: number,
  goalProtein: number,
  safeFloor: number,
  mode: 'lose' | 'gain' | 'maintain',
  lang: string,
): T {
  const ko = lang !== 'English'
  const band = intakeHealthBand(cal, goalCalories, safeFloor)
  const protein = proteinAdequacy(pro, goalProtein)
  let next = { ...parsed }

  if (band === 'unsafe_under') {
    const tags = [
      ko ? '충분히 먹기' : 'Eat enough',
      ko ? '단백질 우선' : 'Protein first',
      ...(next.focus || []),
    ]
    next = {
      ...next,
      focus: tags
        .filter((v, i, a) => a.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i)
        .slice(0, 4),
      advice: ko
        ? `목표보다 너무 적게 먹고 있어요(~${Math.round(cal)}kcal). 감량보다 건강이 먼저예요 — 목표(${goalCalories}kcal) 근처로 올리고 단백질을 챙기세요.`
        : `Intake is too low (~${Math.round(cal)} kcal). Health before faster fat loss — move toward ${goalCalories} kcal with solid protein.`,
      predicted_goal_note: ko
        ? `하루 ${safeFloor}kcal 전후 이하로 오래 가면 근육·에너지에 부담이 커질 수 있어요. 지속 가능한 적자(목표 근처)가 더 안전합니다.`
        : `Staying near/under ~${safeFloor} kcal/day for long stretches can stress muscle and energy. A sustainable deficit near your goal is safer.`,
      energy_trend: {
        direction: 'down',
        explanation: ko
          ? '칼로리가 너무 낮으면 피로·집중력 저하가 오기 쉬워요. 목표 칼로리까지 올리세요.'
          : 'Very low intake often drains energy and focus — raise toward your calorie goal.',
      },
    }
    if (mode === 'lose' && next.weight_trend) {
      next = {
        ...next,
        weight_trend: {
          ...next.weight_trend,
          explanation: ko
            ? `${next.weight_trend.explanation} 다만 극단적 부족은 체지방보다 근육 손실 위험이 커서 권하지 않아요.`
            : `${next.weight_trend.explanation} Extreme under-eating risks more muscle loss than useful fat loss.`,
        },
      }
    }
  } else if (protein === 'critical' || protein === 'low') {
    const tag = ko ? '단백질 보충' : 'More protein'
    next = {
      ...next,
      focus: [tag, ...(next.focus || [])]
        .filter((v, i, a) => a.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i)
        .slice(0, 4),
    }
  }

  return next
}

/**
 * Goal adherence 0–100.
 * Hit the planned deficit — but never reward crash under-eating or low protein.
 */
function computeGoalAdherenceScore(
  trend: {
    meal_count: number
    projected_daily_calories: number | null
    projected_daily_protein: number | null
    avg_daily_calories: number
    avg_daily_protein: number
    confidence: 'low' | 'medium' | 'high'
    projection_usable: boolean
  },
  goalCalories: number,
  goalProtein: number,
  mode: 'lose' | 'gain' | 'maintain',
  safeFloor: number,
): number {
  if (trend.meal_count === 0 || goalCalories <= 0) return 50

  const cal = trend.projection_usable
    ? (trend.projected_daily_calories ?? trend.avg_daily_calories)
    : trend.avg_daily_calories
  const pro = trend.projection_usable
    ? (trend.projected_daily_protein ?? trend.avg_daily_protein)
    : trend.avg_daily_protein

  const calDiff = cal - goalCalories
  const calAbsPct = Math.abs(calDiff) / goalCalories
  const band = intakeHealthBand(cal, goalCalories, safeFloor)

  let calScore = 100
  if (mode === 'lose') {
    if (band === 'unsafe_under') {
      // Crash deficit is not “extra credit”.
      const belowFloor = Math.max(0, safeFloor - cal)
      const belowGoal = Math.max(0, goalCalories * 0.78 - cal)
      calScore = Math.max(12, 42 - (belowFloor / Math.max(safeFloor, 1)) * 35 - (belowGoal / goalCalories) * 40)
    } else if (calDiff > 0) {
      calScore = Math.max(0, 100 - calAbsPct * 220)
    } else if (band === 'mild_under') {
      calScore = 82
    } else {
      calScore = 96
    }
  } else if (mode === 'gain') {
    if (calDiff < 0) {
      calScore = Math.max(0, 100 - calAbsPct * 220)
    } else if (calDiff > 0.18 * goalCalories) {
      calScore = Math.max(45, 100 - ((calDiff - 0.18 * goalCalories) / goalCalories) * 120)
    } else {
      calScore = 96
    }
  } else {
    calScore = Math.max(0, 100 - calAbsPct * 180)
    if (band === 'unsafe_under') calScore = Math.min(calScore, 40)
  }

  let proteinScore = 70
  if (goalProtein > 0) {
    const pDiff = pro - goalProtein
    const pPct = Math.abs(pDiff) / goalProtein
    if (pDiff >= 0) {
      proteinScore = Math.max(55, 100 - Math.max(0, pPct - 0.2) * 80)
    } else {
      proteinScore = Math.max(0, 100 - pPct * 160)
    }
  }

  // Protein weighted higher — especially critical when cutting calories.
  const pWeight = mode === 'lose' ? 0.5 : 0.4
  let score = (1 - pWeight) * calScore + pWeight * proteinScore
  if (band === 'unsafe_under') score = Math.min(score, 55)
  if (trend.confidence === 'low') score = score * 0.82 + 50 * 0.18
  else if (trend.confidence === 'medium') score = score * 0.92 + 50 * 0.08

  return Math.min(100, Math.max(0, Math.round(score)))
}

/**
 * Build intake stats that respect missing photos:
 * - Days with no logs are IGNORED (not 0 kcal).
 * - Missing meal slots on a logged day are filled from slot history, else goal shares.
 * - Weight math uses this filled projected daily average — never raw one-meal totals.
 */
function buildTrendStats(meals: MealInput[], goalCalories: number, goalProtein: number) {
  const byDay = new Map<string, DayBucket>()
  const slotSamples: Record<string, { cal: number[]; protein: number[] }> = {
    breakfast: { cal: [], protein: [] },
    lunch: { cal: [], protein: [] },
    dinner: { cal: [], protein: [] },
    snack: { cal: [], protein: [] },
  }

  for (const m of meals) {
    const day = (m.createdAt ? new Date(m.createdAt) : new Date()).toISOString().slice(0, 10)
    const type = normalizeMealType(m.mealType)
    const cal = Number(m.calories) || 0
    const protein = Number(m.protein) || 0
    const cur = byDay.get(day) ?? {
      cal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      count: 0,
      types: new Set<string>(),
      byType: {},
    }
    cur.cal += cal
    cur.protein += protein
    cur.carbs += Number(m.carbs) || 0
    cur.fat += Number(m.fat) || 0
    cur.count += 1
    cur.types.add(type)
    const slot = cur.byType[type] ?? { cal: 0, protein: 0, count: 0 }
    slot.cal += cal
    slot.protein += protein
    slot.count += 1
    cur.byType[type] = slot
    byDay.set(day, cur)

    if (slotSamples[type]) {
      slotSamples[type].cal.push(cal)
      slotSamples[type].protein.push(protein)
    }
  }

  const slotAvgCal: Record<string, number> = {}
  const slotAvgProtein: Record<string, number> = {}
  for (const key of Object.keys(slotSamples)) {
    slotAvgCal[key] = Math.round(avg(slotSamples[key].cal))
    slotAvgProtein[key] = Math.round(avg(slotSamples[key].protein) * 10) / 10
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

  // Fill missing main slots on every day that has at least one log.
  const filledDays: { cal: number; protein: number; fillCal: number; complete: boolean }[] = []
  for (const d of days) {
    let fillCal = 0
    let fillProtein = 0
    for (const slot of MAIN_SLOTS) {
      if (d.types.has(slot)) continue
      const histCal = slotAvgCal[slot] || 0
      const histProtein = slotAvgProtein[slot] || 0
      if (histCal > 0) {
        fillCal += histCal
        fillProtein += histProtein
      } else if (goalCalories > 0) {
        // Calorie fill from goal shares is OK for weight outlook (low confidence).
        // Do NOT invent protein from goals — that falsely "maintains muscle" when
        // the user only logged a light snack (e.g. yogurt + nuts).
        fillCal += Math.round(goalCalories * SLOT_GOAL_SHARE[slot])
      }
    }
    // If user often logs snacks, add typical snack once when none logged that day.
    const snackHist = slotAvgCal.snack || 0
    if (snackHist > 0 && !d.types.has('snack') && slotSamples.snack.cal.length >= 2) {
      fillCal += snackHist
      fillProtein += slotAvgProtein.snack || 0
    }
    filledDays.push({
      cal: d.cal + fillCal,
      protein: d.protein + fillProtein,
      fillCal,
      complete: isDayComplete(d, goalCalories),
    })
  }

  let projectedDailyCalories: number | null = null
  let projectedDailyProtein: number | null = null
  let projectionBasis: 'complete_days' | 'filled_partial_days' | 'insufficient' = 'insufficient'
  let estimatedFillKcalAvg = 0

  if (completeCount >= 1) {
    // Prefer real complete days when available.
    projectedDailyCalories = Math.round(
      completeDays.reduce((s, d) => s + d.cal, 0) / completeCount,
    )
    projectedDailyProtein =
      Math.round((completeDays.reduce((s, d) => s + d.protein, 0) / completeCount) * 10) / 10
    projectionBasis = 'complete_days'
    // Still note average fill on incomplete days for transparency.
    const incompleteFilled = filledDays.filter((d) => !d.complete)
    if (incompleteFilled.length > 0) {
      estimatedFillKcalAvg = Math.round(avg(incompleteFilled.map((d) => d.fillCal)))
    }
  } else if (filledDays.length > 0) {
    projectedDailyCalories = Math.round(avg(filledDays.map((d) => d.cal)))
    projectedDailyProtein = Math.round(avg(filledDays.map((d) => d.protein)) * 10) / 10
    estimatedFillKcalAvg = Math.round(avg(filledDays.map((d) => d.fillCal)))
    projectionBasis = 'filled_partial_days'
  }

  const fillShare =
    projectedDailyCalories && projectedDailyCalories > 0
      ? estimatedFillKcalAvg / projectedDailyCalories
      : 1

  const incompleteLogging =
    daysLogged === 0 ||
    completeCount === 0 ||
    (goalCalories > 0 && loggedAvg.calories < goalCalories * 0.55 && avgMealsPerDay < 2.5)

  let confidence: 'low' | 'medium' | 'high' = 'low'
  if (completeCount >= 3 && fillShare < 0.15) confidence = 'high'
  else if (completeCount >= 1 || (filledDays.length >= 2 && fillShare < 0.55)) confidence = 'medium'
  else if (filledDays.length >= 1) confidence = 'low'

  const projectionUsable = projectedDailyCalories != null && mealCount > 0

  const coverageRatio =
    goalCalories > 0
      ? Math.min(1, Math.round((loggedAvg.calories / goalCalories) * 100) / 100)
      : Math.min(1, avgMealsPerDay / 3)

  return {
    days_logged: daysLogged,
    complete_days: completeCount,
    meal_count: mealCount,
    avg_meals_per_day: avgMealsPerDay,
    avg_daily_calories: loggedAvg.calories,
    avg_daily_protein: loggedAvg.protein,
    avg_daily_carbs: loggedAvg.carbs,
    avg_daily_fat: loggedAvg.fat,
    projected_daily_calories: projectedDailyCalories,
    projected_daily_protein: projectedDailyProtein,
    projection_basis: projectionBasis,
    projection_usable: projectionUsable,
    incomplete_logging: incompleteLogging,
    fills_unlogged_meals: estimatedFillKcalAvg > 0 || projectionBasis === 'filled_partial_days',
    estimated_fill_kcal_avg: estimatedFillKcalAvg,
    unlogged_days_excluded: true,
    coverage_ratio_vs_goal: coverageRatio,
    confidence,
    slot_averages_kcal: {
      breakfast: slotAvgCal.breakfast || null,
      lunch: slotAvgCal.lunch || null,
      dinner: slotAvgCal.dinner || null,
      snack: slotAvgCal.snack || null,
    },
    goal_calories: goalCalories || null,
    goal_protein: goalProtein || null,
  }
}

/** Only when there is truly nothing to project from. */
function enforceNoDataTrends(
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
      estimate_4w: ko ? '기록 필요' : 'Need logs',
      explanation: ko
        ? '아직 식사 기록이 없어 체중 전망을 낼 수 없어요. 사진을 올리면 미기록 끼니·날도 고려해 추정해요.'
        : 'No meals logged yet — upload photos and we’ll estimate including unlogged meals/days carefully.',
    },
    muscle_trend: {
      direction: 'maintain',
      estimate_4w: ko ? '기록 필요' : 'Need logs',
      explanation: ko
        ? '단백질 전망도 기록이 생긴 뒤 가능해요.'
        : 'Protein outlook needs at least some logged meals.',
    },
    energy_trend: {
      direction: 'stable',
      explanation: ko
        ? '기록이 쌓이면 에너지 경향을 말씀드릴게요.'
        : 'Energy trends appear after some meals are logged.',
    },
    outlook_2w: ko ? '식사를 기록하면 2주 전망을 시작해요.' : 'Log meals to start a 2-week outlook.',
    outlook_4w: ko ? '기록이 이어지면 4주 전망이 생겨요.' : 'Keep logging for a 4-week outlook.',
    outlook_8w: ko ? '꾸준히 기록할수록 8주 추정이 현실에 가까워져요.' : 'Steady logging improves the 8-week estimate.',
    predicted_goal_note: ko
      ? '사진이 없는 날·끼니도 있을 수 있어요. 일단 한 끼부터 올려 보세요.'
      : 'Some days or meals may go unlogged — start with one meal photo.',
    disclaimer: ko
      ? '기록이 없을 때는 전망을 내지 않습니다. 의료 조언이 아닙니다.'
      : 'No outlook without logs. Not medical advice.',
  }
}

/**
 * AI Coach via Responses API + Structured Outputs.
 * Missing photos ≠ 0 kcal; partial days are filled from history/goals for projection.
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
      sex?: string
      heightCm?: number
      age?: number
      bmr?: number
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
    const mode = weightMode(currentWeightKg, goalWeightKg)
    const bmr = Number(body.bmr) || 0
    const safeFloor =
      bmr > 0
        ? safeDailyCalorieFloor(bmr, body.sex)
        : Math.max(absoluteCalorieFloor(body.sex), Math.round(goalCalories * 0.85) || absoluteCalorieFloor(body.sex))
    const adherenceScore = computeGoalAdherenceScore(
      trend,
      goalCalories,
      goalProtein,
      mode,
      safeFloor,
    )

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

    const intakeCal =
      trend.projected_daily_calories ?? trend.avg_daily_calories
    const intakePro =
      trend.projected_daily_protein ?? trend.avg_daily_protein
    const healthBand = intakeHealthBand(intakeCal, goalCalories, safeFloor)
    const proteinBand = proteinAdequacy(intakePro, goalProtein)

    const payload = {
      name,
      goals,
      weight_goal_mode: mode,
      currentWeightKg: currentWeightKg ?? null,
      goalWeightKg: goalWeightKg ?? null,
      safe_calorie_floor: safeFloor,
      intake_health_band: healthBand,
      protein_adequacy: proteinBand,
      goal_adherence_score: adherenceScore,
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
      instructions: `My Cal AI Plus coach. Health first, then fat loss. People skip photos some days/meals — handle that honestly.
User strings in ${lang}. Be terse.

CRITICAL — calorie math:
- Days with NO photos are excluded (never treat as 0 kcal).
- avg_daily_* = logged-only. NEVER use alone for kg forecasts.
- projected_daily_calories may fill missing slots from history/goal shares. USE for weight (~7700 kcal ≈ 1 kg) when projection_usable=true.
- projected_daily_protein fills ONLY from real meal history — never invent protein from goals.
- NEVER invent daily intake as (one meal × 2 or 3).
- weight_goal_mode=${mode}: lose means calorie GOAL is already a sustainable deficit — hitting THAT goal supports fat loss.
- goal_adherence_score is precomputed (0–100). Output "score" MUST equal ${adherenceScore}.
- If fills_unlogged_meals=true: mention estimates; wider ranges when confidence=low.
- If projection_usable=false: logging needed.

CRITICAL — health before aggressive loss:
- intake_health_band=unsafe_under OR calories << goal / below safe_calorie_floor (${safeFloor}): NEVER praise faster weight loss. Tell user to eat closer to the calorie GOAL, keep protein high, protect energy/muscle.
- Do not encourage crash diets, meal skipping all day, or “the less you eat the better”.
- Sustainable loss > dramatic short-term drop.

CRITICAL — protein / muscle:
- muscle_trend MUST follow protein_gap_vs_goal / projected_daily_protein vs goals.protein.
- If protein clearly under goal (gap negative, esp. <85% of goal): muscle_trend.direction="decrease"; put protein first in advice + focus.
- A single light meal (yogurt, nuts, fruit) is NOT enough protein for the day — do NOT claim muscle maintain.
- During weight loss, under-eating protein is worse than mild calorie underage — stress protein every time it's short.

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

    if (!trend.projection_usable || trend.meal_count === 0) {
      parsed = enforceNoDataTrends(parsed, lang)
    } else {
      const proteinForMuscle =
        trend.projected_daily_protein ?? trend.avg_daily_protein
      const calForHealth =
        trend.projected_daily_calories ?? trend.avg_daily_calories
      parsed = enforceMuscleFromProtein(parsed, proteinForMuscle, goalProtein, lang)
      parsed = enforceHealthFirst(
        parsed,
        calForHealth,
        proteinForMuscle,
        goalCalories,
        goalProtein,
        safeFloor,
        mode,
        lang,
      )
    }

    return res.status(200).json({
      summary: parsed.summary,
      advice: parsed.advice,
      focus: parsed.focus?.slice(0, 4) ?? [],
      score: adherenceScore,
      score_kind: 'goal_adherence',
      weight_goal_mode: mode,
      health: {
        safe_calorie_floor: safeFloor,
        intake_band: healthBand,
        protein_adequacy: proteinBand,
      },
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
        fills_unlogged_meals: trend.fills_unlogged_meals,
        estimated_fill_kcal_avg: trend.estimated_fill_kcal_avg,
        projection_basis: trend.projection_basis,
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
