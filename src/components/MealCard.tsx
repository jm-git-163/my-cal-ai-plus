import { useEffect, useState } from 'react'
import type { MealEntry } from '@/types'
import { NumberField } from '@/components/NumberField'
import { mealTypeLabel, useI18n } from '@/hooks/useI18n'
import { analyzeFoodImage } from '@/services/vision'
import { useAppStore } from '@/store/useAppStore'

interface MealCardProps {
  meal: MealEntry
  onDelete?: (id: string) => void
  onUpdate?: (id: string, patch: Partial<Omit<MealEntry, 'id'>>) => Promise<void>
}

export function MealCard({ meal, onDelete, onUpdate }: MealCardProps) {
  const { t, locale } = useI18n()
  const settings = useAppStore((s) => s.settings)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refining, setRefining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [correctionNote, setCorrectionNote] = useState('')
  const [draft, setDraft] = useState(() => draftFromMeal(meal))
  const [baseline, setBaseline] = useState(() => draftFromMeal(meal))

  useEffect(() => {
    if (!editing) {
      const next = draftFromMeal(meal)
      setDraft(next)
      setBaseline(next)
    }
  }, [meal, editing])

  const time = new Date(meal.createdAt).toLocaleTimeString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const items = meal.items?.filter((it) => it.name?.trim()) ?? []
  const ingredients = meal.ingredients?.filter((s) => s.trim()) ?? []
  const assumptions = meal.assumptions?.filter((s) => s.trim()) ?? []
  const canRecalc = Boolean(meal.imageDataUrl?.startsWith('data:image/')) && Boolean(onUpdate)

  function startEdit() {
    const next = draftFromMeal(meal)
    setDraft(next)
    setBaseline(next)
    setEditing(true)
    setError(null)
  }

  function closeEdit() {
    setEditing(false)
    setCorrectionNote('')
    setError(null)
    const next = draftFromMeal(meal)
    setDraft(next)
    setBaseline(next)
  }

  function onCaloriesChange(calories: number) {
    setDraft(scaleMacrosToCalories(baseline, calories))
  }

  function onMacroChange(key: 'protein' | 'carbs' | 'fat' | 'grams', value: number) {
    setDraft((d) => {
      const next = { ...d, [key]: value }
      if (key !== 'grams') {
        next.calories = caloriesFromMacros(next.protein, next.carbs, next.fat)
      }
      return next
    })
  }

  async function saveManual() {
    if (!onUpdate) return
    setSaving(true)
    setError(null)
    try {
      const ratio =
        meal.calories > 0 ? draft.calories / meal.calories : meal.grams > 0 ? draft.grams / meal.grams : 1
      const scaledItems =
        meal.items?.map((it) => ({
          ...it,
          grams: Math.max(0, Math.round(it.grams * ratio)),
          calories: Math.max(0, Math.round(it.calories * ratio)),
        })) ?? meal.items

      await onUpdate(meal.id, {
        food: draft.food.trim() || meal.food,
        grams: draft.grams,
        calories: draft.calories,
        protein: draft.protein,
        carbs: draft.carbs,
        fat: draft.fat,
        items: scaledItems,
      })
      setEditing(false)
      setCorrectionNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t.meal.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  async function recalculate() {
    if (!onUpdate || !meal.imageDataUrl) return
    const note = correctionNote.trim()
    if (!note) {
      setError(t.meal.reanalyzeNeedNote)
      return
    }
    setRefining(true)
    setError(null)
    try {
      const prior = `Prior estimate to revise: ${meal.food} · ${meal.calories}kcal · P${meal.protein}/C${meal.carbs}/F${meal.fat} · ${meal.grams}g`
      const nutrition = await analyzeFoodImage({
        image: meal.imageDataUrl,
        locale,
        currentWeightKg: settings.currentWeightKg,
        goalWeightKg: settings.goalWeightKg,
        calorieGoal: settings.goals.calories,
        userCorrection: `${note}\n${prior}`,
      })
      await onUpdate(meal.id, {
        food: nutrition.food,
        grams: nutrition.grams,
        calories: nutrition.calories,
        protein: nutrition.protein,
        fat: nutrition.fat,
        carbs: nutrition.carbs,
        confidence: nutrition.confidence,
        ingredients: nutrition.ingredients,
        tip: nutrition.tip,
        is_unclear: nutrition.is_unclear,
        items: nutrition.items,
        visible_text: nutrition.visible_text,
        image_quality: nutrition.image_quality,
        portion_note: nutrition.portion_note,
        portionBasis: nutrition.portionBasis,
        assumptions: nutrition.assumptions,
        fieldConfidence: nutrition.fieldConfidence,
        goalImpact: nutrition.goalImpact,
      })
      setEditing(false)
      setCorrectionNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t.meal.reanalyzeFailed)
    } finally {
      setRefining(false)
    }
  }

  return (
    <article className="group glass-card overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:shadow-glass-lift dark:hover:shadow-[0_12px_36px_rgba(0,0,0,0.35)]">
      <div className="flex gap-0 sm:gap-0">
        <button
          type="button"
          onClick={() => {
            setOpen((v) => {
              if (v) closeEdit()
              return !v
            })
          }}
          className="flex min-w-0 flex-1 gap-0 text-left"
          aria-expanded={open}
          aria-label={open ? t.meal.hideDetails : t.meal.showDetails}
        >
          <div className="relative h-[5.5rem] w-[5.5rem] shrink-0 overflow-hidden sm:h-28 sm:w-28">
            {meal.imageDataUrl ? (
              <img src={meal.imageDataUrl} alt={meal.food} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-green to-emerald-700 font-display text-3xl font-bold text-white">
                {meal.food.slice(0, 1)}
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-between p-3 sm:p-4">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-muted dark:bg-white/10 dark:text-white/60">
                  {mealTypeLabel(locale, meal.mealType)}
                </span>
                <span className="tabular text-xs text-brand-muted dark:text-white/45">{time}</span>
                <span className="text-[10px] font-semibold text-brand-green">
                  {open ? t.meal.hideDetails : t.meal.tapForFull}
                </span>
              </div>
              <h3
                className={`font-display text-[15px] font-semibold text-brand-ink dark:text-white sm:text-base ${
                  open ? 'whitespace-pre-wrap break-words' : 'truncate'
                }`}
              >
                {meal.food}
              </h3>
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                <span className="rounded-md bg-brand-blue-soft px-1.5 py-0.5 text-[10px] font-bold text-brand-blue dark:bg-brand-blue/20">
                  P {Math.round(meal.protein)}
                </span>
                <span className="rounded-md bg-brand-orange-soft px-1.5 py-0.5 text-[10px] font-bold text-brand-orange dark:bg-brand-orange/20">
                  C {Math.round(meal.carbs)}
                </span>
                <span className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-bold text-brand-ink dark:bg-white/10 dark:text-white/70">
                  F {Math.round(meal.fat)}
                </span>
              </div>
              <p className="tabular font-display text-xl font-bold tracking-tight text-brand-ink dark:text-white">
                {meal.calories}
                <span className="ml-0.5 text-[10px] font-semibold text-brand-muted">kcal</span>
              </p>
            </div>
          </div>
        </button>

        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(meal.id)}
            className="self-stretch border-l border-black/[0.04] px-3 text-xs font-semibold text-brand-muted opacity-70 transition hover:bg-red-50 hover:text-red-600 hover:opacity-100 dark:border-white/10 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            aria-label={t.meal.delete}
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-3 border-t border-black/[0.05] bg-black/[0.015] px-3 py-3 dark:border-white/10 dark:bg-white/[0.03] sm:px-4">
          {!editing ? (
            <>
              {meal.grams > 0 && (
                <p className="tabular text-xs text-brand-muted dark:text-white/55">
                  {t.meal.portion}: {meal.grams}g
                </p>
              )}

              {items.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-brand-muted">
                    {t.meal.items}
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {items.map((it) => (
                      <li
                        key={`${it.name}-${it.grams}-${it.calories}`}
                        className="flex items-baseline justify-between gap-3 text-sm text-brand-ink dark:text-white/90"
                      >
                        <span className="min-w-0 flex-1 break-words">{it.name}</span>
                        <span className="tabular shrink-0 text-xs text-brand-muted">
                          {Math.round(it.grams)}g · {Math.round(it.calories)} kcal
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {ingredients.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-brand-muted">
                    {t.meal.ingredients}
                  </p>
                  <p className="mt-1 break-words text-sm text-brand-ink dark:text-white/85">
                    {ingredients.join(' · ')}
                  </p>
                </div>
              )}

              {(meal.portionBasis || meal.portion_note) && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-brand-muted">
                    {t.meal.portionBasis}
                  </p>
                  <p className="mt-1 break-words text-sm text-brand-ink dark:text-white/85">
                    {meal.portionBasis || meal.portion_note}
                  </p>
                </div>
              )}

              {assumptions.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-brand-muted">
                    {t.meal.assumptions}
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-brand-ink dark:text-white/85">
                    {assumptions.map((a) => (
                      <li key={a} className="break-words">
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {meal.tip?.trim() && (
                <p className="break-words text-sm text-brand-muted dark:text-white/60">{meal.tip}</p>
              )}

              {items.length === 0 && ingredients.length === 0 && !meal.tip?.trim() && (
                <p className="text-sm text-brand-muted dark:text-white/55">{meal.food}</p>
              )}

              {onUpdate && (
                <button type="button" className="btn-secondary w-full" onClick={startEdit}>
                  {t.meal.edit}
                </button>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="font-display text-base font-semibold text-brand-ink dark:text-white">
                  {t.meal.editTitle}
                </p>
                <p className="mt-1 text-sm text-brand-muted dark:text-white/55">{t.meal.editHint}</p>
              </div>

              <label className="block text-sm font-medium text-brand-ink dark:text-white">
                {t.meal.foodName}
                <input
                  type="text"
                  value={draft.food}
                  onChange={(e) => setDraft((d) => ({ ...d, food: e.target.value }))}
                  className="field-input"
                />
              </label>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <label className="block text-sm font-medium text-brand-ink dark:text-white">
                  kcal
                  <NumberField
                    value={draft.calories}
                    min={0}
                    max={5000}
                    className="field-input"
                    onValueChange={onCaloriesChange}
                  />
                </label>
                <label className="block text-sm font-medium text-brand-ink dark:text-white">
                  g
                  <NumberField
                    value={draft.grams}
                    min={0}
                    max={5000}
                    className="field-input"
                    onValueChange={(grams) => onMacroChange('grams', grams)}
                  />
                </label>
                <label className="block text-sm font-medium text-brand-ink dark:text-white">
                  P
                  <NumberField
                    value={draft.protein}
                    min={0}
                    max={500}
                    decimals={1}
                    className="field-input"
                    onValueChange={(protein) => onMacroChange('protein', protein)}
                  />
                </label>
                <label className="block text-sm font-medium text-brand-ink dark:text-white">
                  C
                  <NumberField
                    value={draft.carbs}
                    min={0}
                    max={500}
                    decimals={1}
                    className="field-input"
                    onValueChange={(carbs) => onMacroChange('carbs', carbs)}
                  />
                </label>
                <label className="block text-sm font-medium text-brand-ink dark:text-white">
                  F
                  <NumberField
                    value={draft.fat}
                    min={0}
                    max={500}
                    decimals={1}
                    className="field-input"
                    onValueChange={(fat) => onMacroChange('fat', fat)}
                  />
                </label>
              </div>

              {canRecalc && (
                <label className="block text-sm font-medium text-brand-ink dark:text-white">
                  {t.meal.correctNote}
                  <textarea
                    value={correctionNote}
                    onChange={(e) => setCorrectionNote(e.target.value.slice(0, 600))}
                    rows={3}
                    placeholder={t.meal.correctNotePlaceholder}
                    className="field-input min-h-[4.5rem] resize-y"
                  />
                </label>
              )}

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={saving || refining}
                  onClick={closeEdit}
                >
                  {t.meal.editCancel}
                </button>
                <button
                  type="button"
                  className="btn-primary flex-1"
                  disabled={saving || refining}
                  onClick={() => void saveManual()}
                >
                  {saving ? t.meal.saving : t.meal.saveEdits}
                </button>
              </div>

              {canRecalc && (
                <button
                  type="button"
                  className="btn-secondary w-full"
                  disabled={saving || refining || !correctionNote.trim()}
                  onClick={() => void recalculate()}
                >
                  {refining ? t.meal.reanalyzing : t.meal.reanalyze}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function draftFromMeal(meal: MealEntry) {
  return {
    food: meal.food,
    grams: meal.grams,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
  }
}

type NutritionDraft = ReturnType<typeof draftFromMeal>

function round1(n: number) {
  return Math.round(n * 10) / 10
}

/** Atwater: kcal ≈ 4P + 4C + 9F */
function caloriesFromMacros(protein: number, carbs: number, fat: number) {
  return Math.max(0, Math.round(4 * protein + 4 * carbs + 9 * fat))
}

/** Keep P/C/F/g in proportion when the user changes total calories. */
function scaleMacrosToCalories(base: NutritionDraft, calories: number): NutritionDraft {
  const nextCal = Math.max(0, Math.round(calories))
  if (base.calories <= 0) {
    return { ...base, calories: nextCal }
  }
  const ratio = nextCal / base.calories
  return {
    ...base,
    calories: nextCal,
    protein: round1(base.protein * ratio),
    carbs: round1(base.carbs * ratio),
    fat: round1(base.fat * ratio),
    grams: Math.max(0, Math.round(base.grams * ratio)),
  }
}
