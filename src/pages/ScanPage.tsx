import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MealType, NutritionResult } from '@/types'
import { CoachWaitPanel } from '@/components/CoachWaitPanel'
import { ConfidenceBar } from '@/components/ConfidenceBar'
import { useI18n } from '@/hooks/useI18n'
import { analyzeFoodImage, validateImageFile } from '@/services/vision'
import { useAppStore } from '@/store/useAppStore'
import { formatConfidence } from '@/utils/nutrition'
import {
  guessMealType,
  resizeForStorage,
  resizeForVision,
} from '@/utils/preprocess'

type Stage = 'idle' | 'preprocessing' | 'analyzing' | 'result' | 'error'

export function ScanPage() {
  const { t, locale } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const addMeal = useAppStore((s) => s.addMeal)
  const updateMeal = useAppStore((s) => s.updateMeal)
  const settings = useAppStore((s) => s.settings)

  const [stage, setStage] = useState<Stage>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const previewBlobRef = useRef<string | null>(null)
  const [processed, setProcessed] = useState<string | null>(null)
  const [result, setResult] = useState<NutritionResult | null>(null)
  const [mealType, setMealType] = useState<MealType>(guessMealType())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [saveNote, setSaveNote] = useState<string | null>(null)

  // Keep meal type in sync after auto-save
  useEffect(() => {
    if (!savedId) return
    void updateMeal(savedId, { mealType }).catch(() => {
      /* ignore transient IDB errors on type tweak */
    })
  }, [mealType, savedId, updateMeal])

  const busy = stage === 'preprocessing' || stage === 'analyzing'

  function revokePreviewBlob() {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current)
      previewBlobRef.current = null
    }
  }

  // Discourage accidental leave while analysis is in flight.
  useEffect(() => {
    if (!busy) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [busy])

  // Keep the wait overlay in view — no scrolling away mid-analysis.
  useEffect(() => {
    if (!busy) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [busy])

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
    setSavedId(null)
    setSaveNote(null)
    revokePreviewBlob()
    const instantPreview = URL.createObjectURL(file)
    previewBlobRef.current = instantPreview
    setPreview(instantPreview)
    setProcessed(null)
    setStage('preprocessing')

    try {
      const rawUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error(t.scan.readFailed))
        reader.readAsDataURL(file)
      })
      revokePreviewBlob()
      setPreview(rawUrl)

      // One resized JPEG (~1024) keeps vision quality with fewer tokens / less upload.
      // Skip Sobel edge preprocess — it cost seconds on phones and the API uses one image only.
      const visionJpeg = await resizeForVision(file, 1024, 0.82)
      setProcessed(visionJpeg)

      setStage('analyzing')
      const nutrition = await analyzeFoodImage({
        image: visionJpeg,
        locale,
        currentWeightKg: settings.currentWeightKg,
        goalWeightKg: settings.goalWeightKg,
        calorieGoal: settings.goals.calories,
      })
      const nextType = guessMealType()
      setResult(nutrition)
      setMealType(nextType)
      setStage('result')

      // Auto-save immediately so leaving the page does not lose the meal.
      const id = crypto.randomUUID()
      const thumb = await resizeForStorage(visionJpeg).catch(() => undefined)
      setSaving(true)
      try {
        await addMeal({
          ...nutrition,
          id,
          mealType: nextType,
          imageDataUrl: thumb,
          createdAt: new Date().toISOString(),
        })
        setSavedId(id)
        setSaveNote(t.scan.savedAuto)
      } catch (err) {
        setError(err instanceof Error ? err.message : t.scan.saveFailed)
      } finally {
        setSaving(false)
      }
    } catch (err) {
      revokePreviewBlob()
      setStage('error')
      setError(err instanceof Error ? err.message : t.scan.analysisFailed)
    }
  }

  async function onSaveAndHome() {
    if (!result) return
    if (savedId) {
      navigate('/')
      return
    }
    setSaving(true)
    try {
      const thumb = await resizeForStorage(processed ?? preview ?? '').catch(() => undefined)
      const id = crypto.randomUUID()
      await addMeal({
        ...result,
        id,
        mealType,
        imageDataUrl: thumb,
        createdAt: new Date().toISOString(),
      })
      setSavedId(id)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : t.scan.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    revokePreviewBlob()
    setStage('idle')
    setPreview(null)
    setProcessed(null)
    setResult(null)
    setError(null)
    setSavedId(null)
    setSaveNote(null)
    if (inputRef.current) inputRef.current.value = ''
  }

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

  const primaryLabel = savedId
    ? saving
      ? t.scan.saving
      : t.scan.goHome
    : saving
      ? t.scan.saving
      : t.scan.saveQuick

  return (
    <>
    <div className="mx-auto w-full max-w-2xl space-y-4 md:max-w-3xl md:space-y-5 pb-36 md:pb-0">
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
          accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />

        {!preview && !busy ? (
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
        ) : preview ? (
          <div className="relative overflow-hidden rounded-[22px]">
            <img
              src={processed ?? preview}
              alt="Meal"
              className={`aspect-[4/3] w-full object-cover sm:aspect-video ${busy ? 'scale-[1.02]' : ''} transition-transform duration-700`}
            />
            {busy && (
              <>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <div className="scan-wait-beam" aria-hidden />
                <p className="absolute inset-x-0 bottom-0 p-4 text-xs font-semibold tracking-wide text-white/85">
                  {stage === 'preprocessing' ? t.scan.preprocessing : t.scan.analyzing}
                </p>
              </>
            )}
          </div>
        ) : null}

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {saveNote && !error && (
          <div className="rounded-2xl border border-brand-green/25 bg-brand-green-soft/70 px-4 py-3 text-sm text-brand-green dark:bg-brand-green/15">
            {saveNote}
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

            <div className="space-y-3 rounded-[22px] border border-black/5 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                {t.scan.viewAnalysis}
              </p>

              {(result.items?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-bold text-brand-muted">{t.scan.multiItems}</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {result.items!.map((it) => (
                      <li
                        key={`${it.name}-${it.grams}-${it.calories}`}
                        className="flex items-baseline justify-between gap-2 text-sm text-brand-ink dark:text-white/85"
                      >
                        <span className="min-w-0 break-words">{it.name}</span>
                        <span className="tabular shrink-0 text-brand-muted">
                          {it.grams}g · {it.calories}kcal
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(result.ingredients?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-bold text-brand-muted">{t.scan.ingredients}</p>
                  <p className="mt-1 text-sm leading-relaxed text-brand-ink dark:text-white/85">
                    {result.ingredients!.join(' · ')}
                  </p>
                </div>
              )}

              {result.portionBasis && (
                <div>
                  <p className="text-xs font-bold text-brand-muted">{t.scan.portionBasis}</p>
                  <p className="mt-1 text-sm text-brand-ink dark:text-white/85">{result.portionBasis}</p>
                </div>
              )}

              {result.portion_note && (
                <div>
                  <p className="text-xs font-bold text-brand-muted">{t.scan.portionNote}</p>
                  <p className="mt-1 text-sm text-brand-ink dark:text-white/85">{result.portion_note}</p>
                </div>
              )}

              {result.visible_text && (
                <div>
                  <p className="text-xs font-bold text-brand-muted">{t.scan.visibleText}</p>
                  <p className="mt-1 text-sm text-brand-ink dark:text-white/85">{result.visible_text}</p>
                </div>
              )}

              {result.assumptions && result.assumptions.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-brand-muted">{t.scan.assumptions}</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-brand-ink dark:text-white/85">
                    {result.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.fieldConfidence && (
                <div>
                  <p className="mb-2 text-xs font-bold text-brand-muted">{t.scan.fieldConfidence}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ConfidenceBar label={t.scan.confFood} value={result.fieldConfidence.food} />
                    <ConfidenceBar label={t.scan.confGrams} value={result.fieldConfidence.grams} />
                    <ConfidenceBar label={t.scan.confCal} value={result.fieldConfidence.calories} />
                    <ConfidenceBar label={t.scan.confP} value={result.fieldConfidence.protein} />
                    <ConfidenceBar label={t.scan.confC} value={result.fieldConfidence.carbs} />
                    <ConfidenceBar label={t.scan.confF} value={result.fieldConfidence.fat} />
                  </div>
                </div>
              )}

              {result.tip && (
                <p className="text-sm text-brand-muted dark:text-white/60">
                  <span className="font-semibold text-brand-green">{t.scan.aiTip}</span> {result.tip}
                </p>
              )}
            </div>

            <p className="rounded-2xl border border-black/5 bg-black/[0.02] px-3 py-2.5 text-sm text-brand-muted dark:border-white/10 dark:bg-white/5 dark:text-white/55">
              {t.scan.editLaterHint}
            </p>

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

            <div className="hidden gap-2 md:flex">
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={saving}
                onClick={() => void onSaveAndHome()}
              >
                {primaryLabel}
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

      {result && stage === 'result' && (
        <div className="fixed inset-x-0 bottom-[4.75rem] z-30 border-t border-brand-ink/10 bg-[#EEF3F0]/95 px-4 py-3 shadow-[0_-4px_16px_rgba(18,21,28,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-[#10161c]/95 md:hidden safe-bottom">
          <div className="mx-auto flex max-w-lg gap-2">
            <button type="button" className="btn-secondary" onClick={reset}>
              {t.scan.scanAnother}
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={saving}
              onClick={() => void onSaveAndHome()}
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      )}
    </div>

    {busy && (
      <div
        className="scan-wait-overlay"
        role="dialog"
        aria-modal="true"
        aria-busy="true"
        aria-labelledby="scan-wait-heading"
      >
        <div className="scan-wait-overlay__inner">
          {preview && (
            <div className="scan-wait-overlay__thumb">
              <img src={processed ?? preview} alt="" className="h-full w-full object-cover" />
              <div className="scan-wait-beam" aria-hidden />
            </div>
          )}
          <CoachWaitPanel
            mode="scan"
            title={t.scan.waitTitle}
            stages={t.scan.waitStages}
            tips={t.scan.waitTips}
            almost={t.scan.waitAlmost}
            hint={t.scan.waitHint}
            tipLabel={t.scan.aiTip || t.coach.tipLabel}
            almostAfterSec={10}
          />
          <p id="scan-wait-heading" className="sr-only">
            {stage === 'preprocessing' ? t.scan.preprocessing : t.scan.analyzing}
          </p>
        </div>
      </div>
    )}
    </>
  )
}
