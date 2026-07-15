import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MealType, NutritionResult } from '@/types'
import { ConfidenceBar } from '@/components/ConfidenceBar'
import { useI18n } from '@/hooks/useI18n'
import { analyzeFoodImage, validateImageFile } from '@/services/vision'
import { useAppStore } from '@/store/useAppStore'
import { formatConfidence } from '@/utils/nutrition'
import { guessMealType, preprocessImage, resizeForVision } from '@/utils/preprocess'

type Stage = 'idle' | 'preprocessing' | 'analyzing' | 'result' | 'error'

export function ScanPage() {
  const { t, locale } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const addMeal = useAppStore((s) => s.addMeal)
  const settings = useAppStore((s) => s.settings)

  const [stage, setStage] = useState<Stage>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [processed, setProcessed] = useState<string | null>(null)
  const [result, setResult] = useState<NutritionResult | null>(null)
  const [mealType, setMealType] = useState<MealType>(guessMealType())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  async function handleFile(file: File) {
    const code = validateImageFile(file)
    if (code === 'UNSUPPORTED_TYPE') {
      setStage('error')
      setError(t.scan.unsupportedType)
      return
    }
    if (code === 'TOO_LARGE') {
      setStage('error')
      setError(t.scan.tooLarge)
      return
    }

    setError(null)
    setResult(null)
    setStage('preprocessing')

    try {
      const rawUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error(t.scan.readFailed))
        reader.readAsDataURL(file)
      })
      setPreview(rawUrl)

      const [visionOriginal, enhanced] = await Promise.all([
        resizeForVision(file, 1536),
        preprocessImage(file, { maxSize: 1536 }),
      ])
      setProcessed(enhanced)

      setStage('analyzing')
      const nutrition = await analyzeFoodImage({
        image: visionOriginal,
        preprocess: enhanced,
        locale,
        currentWeightKg: settings.currentWeightKg,
        goalWeightKg: settings.goalWeightKg,
        calorieGoal: settings.goals.calories,
      })
      setResult(nutrition)
      setMealType(guessMealType())
      setStage('result')
    } catch (err) {
      setStage('error')
      setError(err instanceof Error ? err.message : t.scan.analysisFailed)
    }
  }

  async function onSave() {
    if (!result) return
    setSaving(true)
    try {
      await addMeal({
        ...result,
        id: crypto.randomUUID(),
        mealType,
        imageDataUrl: processed ?? preview ?? undefined,
        createdAt: new Date().toISOString(),
      })
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : t.scan.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setStage('idle')
    setPreview(null)
    setProcessed(null)
    setResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const busy = stage === 'preprocessing' || stage === 'analyzing'
  const impact = result?.goalImpact
  const impactClass =
    impact?.verdict === 'help'
      ? 'border-brand-green/30 bg-brand-green-soft/80 text-brand-green dark:bg-brand-green/15'
      : impact?.verdict === 'caution'
        ? 'border-brand-orange/30 bg-brand-orange-soft/80 text-brand-orange dark:bg-brand-orange/15'
        : 'border-black/5 bg-white/70 text-brand-ink dark:border-white/10 dark:bg-white/10 dark:text-white/80'

  const impactLabel =
    impact?.verdict === 'help'
      ? t.scan.goalHelp
      : impact?.verdict === 'caution'
        ? t.scan.goalCaution
        : t.scan.goalNeutral

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 md:max-w-3xl md:space-y-5 pb-24 md:pb-0">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink dark:text-white sm:text-3xl">
          {t.scan.title}
        </h1>
        <p className="mt-1 text-sm text-brand-muted dark:text-white/55">{t.scan.subtitle}</p>
      </div>

      <div className="glass-card space-y-4 p-4 sm:p-5">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />

        {!preview ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="relative flex w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-[22px] border border-dashed border-brand-green/35 bg-gradient-to-b from-brand-green-soft/80 to-white px-4 py-14 text-center transition hover:border-brand-green/55 dark:from-brand-green/15 dark:to-transparent sm:py-16"
          >
            <span className="fab-scan scan-pulse !translate-y-0 !h-16 !w-16">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M7 4H5a1 1 0 0 0-1 1v2M17 4h2a1 1 0 0 1 1 1v2M7 20H5a1 1 0 0 1-1-1v-2M17 20h2a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="2" />
              </svg>
            </span>
            <div>
              <p className="font-display text-lg font-semibold text-brand-ink dark:text-white">
                {t.scan.uploadTitle}
              </p>
              <p className="mt-1 text-sm text-brand-muted dark:text-white/55">{t.scan.uploadHint}</p>
            </div>
          </button>
        ) : (
          <div className="relative overflow-hidden rounded-[22px]">
            <img
              src={processed ?? preview}
              alt="Meal"
              className="aspect-[4/3] w-full object-cover sm:aspect-video"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-4 pt-16">
              {busy && (
                <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
                  {stage === 'preprocessing' ? t.scan.preprocessing : t.scan.analyzing}
                </p>
              )}
            </div>
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[2px]">
                <div className="rounded-2xl bg-white/95 px-5 py-3 text-sm font-semibold text-brand-ink shadow-lg dark:bg-[#121820]/95 dark:text-white">
                  {stage === 'preprocessing' ? t.scan.preprocessing : t.scan.analyzing}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {result && stage === 'result' && (
          <div className="space-y-4">
            <div className="rounded-[22px] bg-gradient-to-br from-brand-green-soft to-white p-5 dark:from-brand-green/20 dark:to-white/5">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-green">{result.food}</p>
              <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
                <p className="tabular font-display text-5xl font-bold tracking-tight text-brand-ink dark:text-white">
                  {result.calories}
                  <span className="ml-1 text-base font-semibold text-brand-muted">kcal</span>
                </p>
                <p className="tabular mb-1 text-sm font-medium text-brand-muted">
                  {result.grams}g · {formatConfidence(result.confidence)}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white/80 py-2.5 dark:bg-white/10">
                  <p className="text-[10px] font-bold text-brand-blue">P</p>
                  <p className="tabular font-semibold text-brand-ink dark:text-white">{result.protein}g</p>
                </div>
                <div className="rounded-xl bg-white/80 py-2.5 dark:bg-white/10">
                  <p className="text-[10px] font-bold text-brand-orange">C</p>
                  <p className="tabular font-semibold text-brand-ink dark:text-white">{result.carbs}g</p>
                </div>
                <div className="rounded-xl bg-white/80 py-2.5 dark:bg-white/10">
                  <p className="text-[10px] font-bold text-brand-muted">F</p>
                  <p className="tabular font-semibold text-brand-ink dark:text-white">{result.fat}g</p>
                </div>
              </div>
            </div>

            {impact?.message && (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${impactClass}`}>
                <p className="font-bold">{impactLabel}</p>
                <p className="mt-1 opacity-90">{impact.message}</p>
              </div>
            )}

            <label className="block text-sm font-medium text-brand-ink dark:text-white">
              {t.scan.mealType}
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
                className="field-input"
              >
                <option value="Breakfast">{t.scan.breakfast}</option>
                <option value="Lunch">{t.scan.lunch}</option>
                <option value="Dinner">{t.scan.dinner}</option>
                <option value="Snack">{t.scan.snack}</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="w-full rounded-xl bg-black/[0.03] px-3 py-2.5 text-left text-sm font-semibold text-brand-ink dark:bg-white/5 dark:text-white"
            >
              {showDetails ? t.scan.hideAdvanced : t.scan.assumptions} / {t.scan.fieldConfidence}
            </button>

            {showDetails && (
              <div className="space-y-3">
                {result.portionBasis && (
                  <div className="rounded-xl bg-white/70 px-3 py-2 text-sm dark:bg-white/10">
                    <p className="text-xs font-bold text-brand-muted">{t.scan.portionBasis}</p>
                    <p className="mt-1">{result.portionBasis}</p>
                  </div>
                )}
                {result.assumptions && result.assumptions.length > 0 && (
                  <ul className="list-disc space-y-1 rounded-xl border border-brand-orange/20 bg-brand-orange-soft/40 px-5 py-3 text-sm dark:bg-brand-orange/10">
                    {result.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                )}
                {result.fieldConfidence && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ConfidenceBar label={t.scan.confFood} value={result.fieldConfidence.food} />
                    <ConfidenceBar label={t.scan.confGrams} value={result.fieldConfidence.grams} />
                    <ConfidenceBar label={t.scan.confCal} value={result.fieldConfidence.calories} />
                    <ConfidenceBar label={t.scan.confP} value={result.fieldConfidence.protein} />
                    <ConfidenceBar label={t.scan.confC} value={result.fieldConfidence.carbs} />
                    <ConfidenceBar label={t.scan.confF} value={result.fieldConfidence.fat} />
                  </div>
                )}
                {result.tip && <p className="text-sm text-brand-muted dark:text-white/60">{result.tip}</p>}
              </div>
            )}

            <div className="hidden gap-2 md:flex">
              <button type="button" className="btn-primary flex-1" disabled={saving} onClick={() => void onSave()}>
                {saving ? t.scan.saving : t.scan.save}
              </button>
              <button type="button" className="btn-secondary" onClick={reset}>
                {t.scan.scanAnother}
              </button>
            </div>
          </div>
        )}

        {preview && !busy && stage !== 'result' && (
          <button type="button" className="btn-secondary w-full" onClick={reset}>
            {t.scan.chooseOther}
          </button>
        )}
      </div>

      {/* Mobile sticky save bar */}
      {result && stage === 'result' && (
        <div className="fixed inset-x-0 bottom-[4.75rem] z-30 border-t border-brand-ink/10 bg-[#EEF3F0]/95 px-4 py-3 shadow-[0_-4px_16px_rgba(18,21,28,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-[#10161c]/95 md:hidden safe-bottom">
          <div className="mx-auto flex max-w-lg gap-2">
            <button type="button" className="btn-secondary" onClick={reset}>
              {t.scan.scanAnother}
            </button>
            <button type="button" className="btn-primary flex-1" disabled={saving} onClick={() => void onSave()}>
              {saving ? t.scan.saving : t.scan.saveQuick}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
