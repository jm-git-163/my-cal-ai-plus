import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MealType, NutritionResult, VisionDetail } from '@/types'
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
  const [detail, setDetail] = useState<VisionDetail>(settings.visionDetail)

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
        detail,
        model: settings.visionModel || undefined,
        twoPass: settings.visionTwoPass,
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
    <div className="mx-auto w-full max-w-3xl space-y-5 md:space-y-6 lg:max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink dark:text-white sm:text-3xl lg:text-4xl">
          {t.scan.title}
        </h1>
        <p className="mt-1 text-sm text-brand-muted dark:text-white/60 sm:text-base">{t.scan.subtitle}</p>
      </div>

      <div className="glass-card space-y-4 p-4 sm:p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-brand-ink dark:text-white">{t.scan.detailLabel}</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['low', t.scan.detailLow],
                  ['high', t.scan.detailHigh],
                  ['original', t.scan.detailOriginal],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={busy}
                  onClick={() => setDetail(value)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    detail === value
                      ? 'bg-brand-green text-white'
                      : 'bg-black/5 text-brand-ink dark:bg-white/10 dark:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-brand-muted dark:text-white/45">{t.scan.detailHint}</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-brand-ink dark:text-white">{t.scan.twoPass}</p>
            <p className="text-xs text-brand-muted dark:text-white/55">
              {settings.visionTwoPass ? t.scan.twoPassOn : t.scan.twoPassOff}
              {' · '}
              {settings.visionModel || t.scan.modelDefault}
            </p>
            <p className="mt-2 text-xs text-brand-muted dark:text-white/45">{t.scan.dualView}</p>
          </div>
        </div>

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
            className="flex w-full flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-brand-green/30 bg-brand-green-soft/40 px-4 py-12 text-center transition hover:border-brand-green/50 dark:bg-brand-green/10 sm:py-16"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-green text-2xl text-white shadow-soft">
              +
            </span>
            <span className="font-display text-base font-semibold text-brand-ink dark:text-white sm:text-lg">
              {t.scan.uploadTitle}
            </span>
            <span className="text-sm text-brand-muted dark:text-white/55">{t.scan.uploadHint}</span>
          </button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <figure>
              <figcaption className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-muted dark:text-white/50">
                {t.scan.original}
              </figcaption>
              <img src={preview} alt="Original meal" className="aspect-square w-full rounded-2xl object-cover" />
            </figure>
            <figure>
              <figcaption className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-muted dark:text-white/50">
                {t.scan.preprocess}
              </figcaption>
              <img
                src={processed ?? preview}
                alt="Preprocessed meal"
                className="aspect-square w-full rounded-2xl object-cover"
              />
            </figure>
          </div>
        )}

        {busy && (
          <div className="rounded-2xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand-ink dark:bg-white/10 dark:text-white">
            {stage === 'preprocessing' ? t.scan.preprocessing : t.scan.analyzing}
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
            <p className="mt-1 text-xs text-red-600/80 dark:text-red-300/80">{t.scan.tip}</p>
          </div>
        )}

        {result && stage === 'result' && (
          <div className="space-y-4 rounded-2xl border border-brand-green/20 bg-brand-green-soft/40 p-4 dark:bg-brand-green/10 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-xl font-bold text-brand-ink dark:text-white sm:text-2xl">
                  {result.food}
                </h2>
                <p className="text-sm text-brand-muted dark:text-white/55">
                  ~{result.grams}g · {t.scan.confidence} {formatConfidence(result.confidence)}
                  {result.twoPass ? ' · 2-pass' : ''}
                  {result.model ? ` · ${result.model}` : ''}
                </p>
              </div>
              <p className="font-display text-2xl font-bold text-brand-green sm:text-3xl">{result.calories} kcal</p>
            </div>

            {impact?.message && (
              <div className={`rounded-2xl border px-3 py-3 text-sm ${impactClass}`}>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{t.scan.goalCoach}</p>
                <p className="mt-1 font-semibold">{impactLabel}</p>
                <p className="mt-1 opacity-90">{impact.message}</p>
              </div>
            )}

            <p className="text-xs text-brand-muted dark:text-white/45">{t.scan.disclaimer}</p>

            {result.is_unclear && (
              <p className="rounded-xl bg-brand-orange-soft/80 px-3 py-2 text-xs font-medium text-brand-orange dark:bg-brand-orange/20">
                {t.scan.unclear}
              </p>
            )}

            {result.fieldConfidence && (
              <div className="rounded-2xl bg-white/70 p-3 dark:bg-white/5 sm:p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-muted dark:text-white/50">
                  {t.scan.fieldConfidence}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ConfidenceBar label={t.scan.confFood} value={result.fieldConfidence.food} />
                  <ConfidenceBar label={t.scan.confGrams} value={result.fieldConfidence.grams} />
                  <ConfidenceBar label={t.scan.confCal} value={result.fieldConfidence.calories} />
                  <ConfidenceBar label={t.scan.confP} value={result.fieldConfidence.protein} />
                  <ConfidenceBar label={t.scan.confC} value={result.fieldConfidence.carbs} />
                  <ConfidenceBar label={t.scan.confF} value={result.fieldConfidence.fat} />
                </div>
              </div>
            )}

            {result.portionBasis && (
              <div className="rounded-xl bg-white/70 px-3 py-2 text-sm dark:bg-white/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted dark:text-white/50">
                  {t.scan.portionBasis}
                </p>
                <p className="mt-1 text-brand-ink dark:text-white/85">{result.portionBasis}</p>
              </div>
            )}

            {result.assumptions && result.assumptions.length > 0 && (
              <div className="rounded-xl border border-brand-orange/20 bg-brand-orange-soft/50 px-3 py-2 dark:bg-brand-orange/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-orange">{t.scan.assumptions}</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-brand-ink dark:text-white/80">
                  {result.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.tip && (
              <div className="rounded-xl bg-white/70 px-3 py-2 text-sm dark:bg-white/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted dark:text-white/50">
                  {t.scan.aiTip}
                </p>
                <p className="mt-1 text-brand-ink dark:text-white/85">{result.tip}</p>
              </div>
            )}

            {result.ingredients && result.ingredients.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-muted dark:text-white/50">
                  {t.scan.ingredients}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.ingredients.map((ing) => (
                    <span
                      key={ing}
                      className="rounded-lg bg-white/80 px-2 py-1 text-xs font-medium text-brand-ink dark:bg-white/10 dark:text-white/80"
                    >
                      {ing}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-xl bg-white/80 px-2 py-3 dark:bg-white/10">
                <p className="text-brand-muted dark:text-white/50">{t.dashboard.protein}</p>
                <p className="font-semibold text-brand-blue">{result.protein}g</p>
              </div>
              <div className="rounded-xl bg-white/80 px-2 py-3 dark:bg-white/10">
                <p className="text-brand-muted dark:text-white/50">{t.dashboard.carbs}</p>
                <p className="font-semibold text-brand-orange">{result.carbs}g</p>
              </div>
              <div className="rounded-xl bg-white/80 px-2 py-3 dark:bg-white/10">
                <p className="text-brand-muted dark:text-white/50">{t.dashboard.fat}</p>
                <p className="font-semibold text-brand-ink dark:text-white">{result.fat}g</p>
              </div>
            </div>

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

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={saving} onClick={() => void onSave()}>
                {saving ? t.scan.saving : t.scan.save}
              </button>
              <button type="button" className="btn-secondary" onClick={reset}>
                {t.scan.scanAnother}
              </button>
            </div>
          </div>
        )}

        {preview && !busy && stage !== 'result' && (
          <button type="button" className="btn-secondary" onClick={reset}>
            {t.scan.chooseOther}
          </button>
        )}
      </div>
    </div>
  )
}
