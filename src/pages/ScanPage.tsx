import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MealType, NutritionResult } from '@/types'
import { useI18n } from '@/hooks/useI18n'
import { analyzeFoodImage } from '@/services/vision'
import { useAppStore } from '@/store/useAppStore'
import { formatConfidence } from '@/utils/nutrition'
import { guessMealType, preprocessImage } from '@/utils/preprocess'

type Stage = 'idle' | 'preprocessing' | 'analyzing' | 'result' | 'error'

export function ScanPage() {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const addMeal = useAppStore((s) => s.addMeal)

  const [stage, setStage] = useState<Stage>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [processed, setProcessed] = useState<string | null>(null)
  const [result, setResult] = useState<NutritionResult | null>(null)
  const [mealType, setMealType] = useState<MealType>(guessMealType())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleFile(file: File) {
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

      const enhanced = await preprocessImage(file)
      setProcessed(enhanced)

      setStage('analyzing')
      const nutrition = await analyzeFoodImage(enhanced)
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-brand-ink dark:text-white">
          {t.scan.title}
        </h1>
        <p className="mt-1 text-brand-muted dark:text-white/60">{t.scan.subtitle}</p>
      </div>

      <div className="glass-card space-y-4 p-5 sm:p-6">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
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
            className="flex w-full flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-brand-green/30 bg-brand-green-soft/40 px-6 py-16 text-center transition hover:border-brand-green/50 dark:bg-brand-green/10"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-green text-2xl text-white shadow-soft">
              +
            </span>
            <span className="font-display text-lg font-semibold text-brand-ink dark:text-white">
              {t.scan.uploadTitle}
            </span>
            <span className="text-sm text-brand-muted dark:text-white/55">{t.scan.uploadHint}</span>
          </button>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="space-y-4 rounded-2xl border border-brand-green/20 bg-brand-green-soft/50 p-4 dark:bg-brand-green/10">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-xl font-bold text-brand-ink dark:text-white">{result.food}</h2>
                <p className="text-sm text-brand-muted dark:text-white/55">
                  ~{result.grams}g · {t.scan.confidence} {formatConfidence(result.confidence)}
                </p>
              </div>
              <p className="font-display text-2xl font-bold text-brand-green">{result.calories} kcal</p>
            </div>
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
