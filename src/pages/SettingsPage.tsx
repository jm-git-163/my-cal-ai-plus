import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { ActivityLevel, BiologicalSex, DailyGoals, UserSettings } from '@/types'
import { NumberField } from '@/components/NumberField'
import { useI18n } from '@/hooks/useI18n'
import { tReplace } from '@/i18n/translations'
import { useAppStore } from '@/store/useAppStore'
import { recommendDailyGoals } from '@/utils/recommendGoals'

export function SettingsPage() {
  const { t } = useI18n()
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const setLocale = useAppStore((s) => s.setLocale)
  const setTheme = useAppStore((s) => s.setTheme)
  const [form, setForm] = useState<UserSettings>(settings)
  const [saved, setSaved] = useState(false)
  const [recommendedJustNow, setRecommendedJustNow] = useState(false)

  useEffect(() => {
    setForm(settings)
  }, [settings])

  const preview = useMemo(() => recommendDailyGoals(form), [form])

  function patchForm(partial: Partial<UserSettings>) {
    setForm((prev) => ({ ...prev, ...partial }))
    setSaved(false)
    setRecommendedJustNow(false)
  }

  function setGoal<K extends keyof DailyGoals>(key: K, value: number) {
    setForm((prev) => ({
      ...prev,
      goals: { ...prev.goals, [key]: value },
      goalsFromRecommend: false,
    }))
    setSaved(false)
    setRecommendedJustNow(false)
  }

  function applyRecommend() {
    const rec = recommendDailyGoals(form)
    setForm((prev) => ({
      ...prev,
      goals: rec.goals,
      goalsFromRecommend: true,
    }))
    setSaved(false)
    setRecommendedJustNow(true)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await updateSettings({ ...form, profileSetupDone: true })
    setSaved(true)
    setRecommendedJustNow(false)
  }

  const modeLabel =
    preview.mode === 'lose'
      ? t.settings.modeLose
      : preview.mode === 'gain'
        ? t.settings.modeGain
        : t.settings.modeMaintain

  const adjustLabel =
    preview.calorieAdjust === 0
      ? '±0'
      : preview.calorieAdjust > 0
        ? `+${preview.calorieAdjust}`
        : String(preview.calorieAdjust)

  const summary = tReplace(t.settings.recommendSummary, {
    bmr: String(preview.bmr),
    tdee: String(preview.tdee),
    mode: modeLabel,
    adjust: adjustLabel,
    cal: String(preview.goals.calories),
    p: String(preview.goals.protein),
    c: String(preview.goals.carbs),
    f: String(preview.goals.fat),
  })

  const goalFields = [
    ['calories', t.settings.calories],
    ['protein', t.settings.protein],
    ['carbs', t.settings.carbs],
    ['fat', t.settings.fat],
    ['waterMl', t.settings.water],
    ['exerciseMin', t.settings.exercise],
  ] as const

  const sexOptions: { value: BiologicalSex; label: string }[] = [
    { value: 'female', label: t.settings.sexFemale },
    { value: 'male', label: t.settings.sexMale },
    { value: 'unspecified', label: t.settings.sexUnspecified },
  ]

  const activityOptions: { value: ActivityLevel; label: string }[] = [
    { value: 'sedentary', label: t.settings.activitySedentary },
    { value: 'light', label: t.settings.activityLight },
    { value: 'moderate', label: t.settings.activityModerate },
    { value: 'active', label: t.settings.activityActive },
    { value: 'very_active', label: t.settings.activityVeryActive },
  ]

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 md:max-w-2xl md:space-y-6 lg:max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink dark:text-white sm:text-3xl">
          {t.settings.title}
        </h1>
        <p className="mt-1 text-sm text-brand-muted dark:text-white/60">{t.settings.subtitle}</p>
      </div>

      <section className="glass-card space-y-4 p-4 sm:p-5 md:p-6">
        <h2 className="font-display text-lg font-semibold text-brand-ink dark:text-white">
          {t.settings.appearance}
        </h2>
        <div>
          <p className="mb-2 text-sm font-medium text-brand-ink dark:text-white">{t.language}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void setLocale('ko')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                settings.locale === 'ko'
                  ? 'bg-brand-green text-white'
                  : 'bg-black/5 text-brand-ink dark:bg-white/10 dark:text-white'
              }`}
            >
              한국어
            </button>
            <button
              type="button"
              onClick={() => void setLocale('en')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                settings.locale === 'en'
                  ? 'bg-brand-green text-white'
                  : 'bg-black/5 text-brand-ink dark:bg-white/10 dark:text-white'
              }`}
            >
              English
            </button>
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-brand-ink dark:text-white">{t.theme}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void setTheme('light')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                settings.theme === 'light'
                  ? 'bg-brand-green text-white'
                  : 'bg-black/5 text-brand-ink dark:bg-white/10 dark:text-white'
              }`}
            >
              {t.themeLight}
            </button>
            <button
              type="button"
              onClick={() => void setTheme('dark')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                settings.theme === 'dark'
                  ? 'bg-brand-green text-white'
                  : 'bg-black/5 text-brand-ink dark:bg-white/10 dark:text-white'
              }`}
            >
              {t.themeDark}
            </button>
          </div>
        </div>
      </section>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
        <section className="glass-card space-y-4 p-4 sm:p-5 md:p-6">
          <h2 className="font-display text-lg font-semibold text-brand-ink dark:text-white">
            {t.settings.profileBasics}
          </h2>
          <p className="text-xs text-brand-muted dark:text-white/50">{t.settings.profileBasicsHint}</p>
          <label className="block text-sm font-medium text-brand-ink dark:text-white">
            {t.settings.displayName}
            <input
              value={form.name}
              onChange={(e) => patchForm({ name: e.target.value })}
              className="field-input"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-brand-ink dark:text-white">
              {t.settings.currentWeight}
              <NumberField
                min={20}
                max={300}
                step={0.1}
                decimals={1}
                value={form.currentWeightKg || 65}
                onValueChange={(currentWeightKg) => patchForm({ currentWeightKg })}
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
                value={form.goalWeightKg || 60}
                onValueChange={(goalWeightKg) => patchForm({ goalWeightKg })}
                className="field-input"
              />
            </label>
          </div>
        </section>

        <section className="glass-card space-y-4 p-4 sm:p-5 md:p-6">
          <h2 className="font-display text-lg font-semibold text-brand-ink dark:text-white">
            {t.settings.profileSection}
          </h2>
          <p className="text-xs text-brand-muted dark:text-white/50">{t.settings.profileHint}</p>

          <div>
            <p className="mb-2 text-sm font-medium text-brand-ink dark:text-white">{t.settings.sex}</p>
            <div className="flex flex-wrap gap-2">
              {sexOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => patchForm({ sex: opt.value })}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                    form.sex === opt.value
                      ? 'bg-brand-green text-white'
                      : 'bg-black/5 text-brand-ink dark:bg-white/10 dark:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-brand-ink dark:text-white">
              {t.settings.height}
              <NumberField
                min={120}
                max={230}
                decimals={0}
                value={form.heightCm}
                onValueChange={(heightCm) => patchForm({ heightCm })}
                className="field-input"
              />
            </label>
            <label className="block text-sm font-medium text-brand-ink dark:text-white">
              {t.settings.age}
              <NumberField
                min={14}
                max={90}
                decimals={0}
                value={form.age}
                onValueChange={(age) => patchForm({ age })}
                className="field-input"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-brand-ink dark:text-white">
            {t.settings.activity}
            <select
              value={form.activityLevel}
              onChange={(e) => patchForm({ activityLevel: e.target.value as ActivityLevel })}
              className="field-input"
            >
              {activityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="glass-card space-y-5 p-4 sm:p-5 md:p-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-brand-ink dark:text-white">
              {t.settings.nutritionGoals}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-brand-muted dark:text-white/50">
              {t.settings.goalsHint}
            </p>
          </div>

          <div className="rounded-2xl bg-brand/5 p-4 dark:bg-white/5">
            <p className="text-xs leading-relaxed text-brand-ink/80 dark:text-white/70">{summary}</p>
            <button
              type="button"
              onClick={applyRecommend}
              className="btn-primary mt-3 w-full sm:w-auto"
            >
              {t.settings.recommendGoals}
            </button>
            {recommendedJustNow && (
              <p className="mt-2 text-sm font-medium text-brand-green">{t.settings.recommendApplied}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {goalFields.map(([key, label]) => (
              <label key={key} className="block text-sm font-medium text-brand-ink dark:text-white">
                {label}
                <NumberField
                  min={0}
                  decimals={0}
                  value={form.goals[key]}
                  onValueChange={(v) => setGoal(key, v)}
                  className="field-input"
                />
              </label>
            ))}
          </div>

          <button type="submit" className="btn-primary w-full sm:w-auto">
            {t.settings.save}
          </button>
          {saved && <p className="text-sm font-medium text-brand-green">{t.settings.saved}</p>}
        </section>
      </form>
    </div>
  )
}
