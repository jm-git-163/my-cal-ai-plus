import { useState, type FormEvent, type ReactNode } from 'react'
import { NumberField } from '@/components/NumberField'
import { useI18n } from '@/hooks/useI18n'
import { useAppStore } from '@/store/useAppStore'
import { recommendDailyGoals } from '@/utils/recommendGoals'

export function ProfileSetupGate({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const needsSetup = !settings.profileSetupDone

  const [name, setName] = useState('')
  const [currentWeightKg, setCurrentWeightKg] = useState(65)
  const [goalWeightKg, setGoalWeightKg] = useState(60)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!needsSetup) return <>{children}</>

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t.onboarding.nameRequired)
      return
    }
    if (currentWeightKg < 20 || currentWeightKg > 300 || goalWeightKg < 20 || goalWeightKg > 300) {
      setError(t.onboarding.weightInvalid)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const next = {
        ...settings,
        name: trimmed,
        currentWeightKg,
        goalWeightKg,
        profileSetupDone: true,
      }
      const rec = recommendDailyGoals(next)
      await updateSettings({
        ...next,
        goals: rec.goals,
        goalsFromRecommend: true,
      })
    } catch {
      setError(t.onboarding.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-hero px-5 py-10 dark:bg-hero-dark">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="w-full max-w-md space-y-5 rounded-[28px] border border-black/[0.05] bg-white/95 p-6 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-[#10161c]/95 sm:p-8"
      >
        <div className="text-center">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand-green">
            My Cal AI Plus
          </p>
          <h1 className="mt-3 font-display text-2xl font-bold text-brand-ink dark:text-white">
            {t.onboarding.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-brand-muted dark:text-white/60">
            {t.onboarding.subtitle}
          </p>
        </div>

        <label className="block text-sm font-medium text-brand-ink dark:text-white">
          {t.settings.displayName}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.onboarding.namePlaceholder}
            autoFocus
            className="field-input"
            autoComplete="nickname"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-brand-ink dark:text-white">
            {t.settings.currentWeight}
            <NumberField
              min={20}
              max={300}
              step={0.1}
              decimals={1}
              value={currentWeightKg}
              onValueChange={setCurrentWeightKg}
              className="field-input"
            />
          </label>
          <label className="block text-sm font-medium text-brand-ink dark:text-white">
            {t.settings.goalWeight}
            <NumberField
              min={20}
              max={300}
              step={0.1}
              decimals={1}
              value={goalWeightKg}
              onValueChange={setGoalWeightKg}
              className="field-input"
            />
          </label>
        </div>

        <p className="text-xs text-brand-muted dark:text-white/45">{t.onboarding.hint}</p>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={saving}>
          {saving ? t.onboarding.saving : t.onboarding.start}
        </button>
      </form>
    </div>
  )
}
