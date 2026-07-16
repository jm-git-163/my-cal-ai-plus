import { useState } from 'react'
import type { MealEntry } from '@/types'
import { mealTypeLabel, useI18n } from '@/hooks/useI18n'

interface MealCardProps {
  meal: MealEntry
  onDelete?: (id: string) => void
}

export function MealCard({ meal, onDelete }: MealCardProps) {
  const { t, locale } = useI18n()
  const [open, setOpen] = useState(false)
  const time = new Date(meal.createdAt).toLocaleTimeString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const items = meal.items?.filter((it) => it.name?.trim()) ?? []
  const ingredients = meal.ingredients?.filter((s) => s.trim()) ?? []
  const assumptions = meal.assumptions?.filter((s) => s.trim()) ?? []
  const hasDetails =
    items.length > 0 ||
    ingredients.length > 0 ||
    Boolean(meal.tip?.trim()) ||
    Boolean(meal.portion_note?.trim()) ||
    Boolean(meal.portionBasis?.trim()) ||
    assumptions.length > 0 ||
    meal.food.length > 28

  return (
    <article className="group glass-card overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:shadow-glass-lift dark:hover:shadow-[0_12px_36px_rgba(0,0,0,0.35)]">
      <div className="flex gap-0 sm:gap-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
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
                {hasDetails && (
                  <span className="text-[10px] font-semibold text-brand-green">
                    {open ? t.meal.hideDetails : t.meal.tapForFull}
                  </span>
                )}
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

          {!hasDetails && (
            <p className="text-sm text-brand-muted dark:text-white/55">{meal.food}</p>
          )}
        </div>
      )}
    </article>
  )
}
