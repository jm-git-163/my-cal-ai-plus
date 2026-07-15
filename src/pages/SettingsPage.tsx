import { useEffect, useState, type FormEvent } from 'react'
import type { DailyGoals, UserSettings, VisionDetail } from '@/types'
import { useI18n } from '@/hooks/useI18n'
import { useAppStore } from '@/store/useAppStore'

export function SettingsPage() {
  const { t } = useI18n()
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const setLocale = useAppStore((s) => s.setLocale)
  const setTheme = useAppStore((s) => s.setTheme)
  const [form, setForm] = useState<UserSettings>(settings)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setForm(settings)
  }, [settings])

  function setGoal<K extends keyof DailyGoals>(key: K, value: number) {
    setForm((prev) => ({
      ...prev,
      goals: { ...prev.goals, [key]: value },
    }))
    setSaved(false)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await updateSettings(form)
    setSaved(true)
  }

  const goalFields = [
    ['calories', t.settings.calories],
    ['protein', t.settings.protein],
    ['carbs', t.settings.carbs],
    ['fat', t.settings.fat],
    ['waterMl', t.settings.water],
    ['exerciseMin', t.settings.exercise],
  ] as const

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
            {t.settings.weightSection}
          </h2>
          <p className="text-xs text-brand-muted dark:text-white/50">{t.settings.weightHint}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-brand-ink dark:text-white">
              {t.settings.currentWeight}
              <input
                type="number"
                min={20}
                max={300}
                step={0.1}
                value={form.currentWeightKg}
                onChange={(e) => {
                  setForm({ ...form, currentWeightKg: Number(e.target.value) || 0 })
                  setSaved(false)
                }}
                className="field-input"
              />
            </label>
            <label className="block text-sm font-medium text-brand-ink dark:text-white">
              {t.settings.goalWeight}
              <input
                type="number"
                min={20}
                max={300}
                step={0.1}
                value={form.goalWeightKg}
                onChange={(e) => {
                  setForm({ ...form, goalWeightKg: Number(e.target.value) || 0 })
                  setSaved(false)
                }}
                className="field-input"
              />
            </label>
          </div>
        </section>

        <section className="glass-card space-y-4 p-4 sm:p-5 md:p-6">
          <h2 className="font-display text-lg font-semibold text-brand-ink dark:text-white">
            {t.settings.visionSection}
          </h2>
          <label className="block text-sm font-medium text-brand-ink dark:text-white">
            {t.scan.modelLabel}
            <select
              value={form.visionModel}
              onChange={(e) => {
                setForm({ ...form, visionModel: e.target.value })
                setSaved(false)
              }}
              className="field-input"
            >
              <option value="">{t.scan.modelDefault}</option>
              <option value="gpt-5.6">gpt-5.6</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4.1">gpt-4.1</option>
            </select>
          </label>
          <div>
            <p className="mb-2 text-sm font-medium text-brand-ink dark:text-white">{t.scan.twoPass}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setForm({ ...form, visionTwoPass: true })
                  setSaved(false)
                }}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  form.visionTwoPass
                    ? 'bg-brand-green text-white'
                    : 'bg-black/5 text-brand-ink dark:bg-white/10 dark:text-white'
                }`}
              >
                {t.scan.twoPassOn}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm({ ...form, visionTwoPass: false })
                  setSaved(false)
                }}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  !form.visionTwoPass
                    ? 'bg-brand-green text-white'
                    : 'bg-black/5 text-brand-ink dark:bg-white/10 dark:text-white'
                }`}
              >
                {t.scan.twoPassOff}
              </button>
            </div>
          </div>
          <label className="block text-sm font-medium text-brand-ink dark:text-white">
            {t.scan.detailLabel}
            <select
              value={form.visionDetail}
              onChange={(e) => {
                setForm({ ...form, visionDetail: e.target.value as VisionDetail })
                setSaved(false)
              }}
              className="field-input"
            >
              <option value="low">{t.scan.detailLow}</option>
              <option value="high">{t.scan.detailHigh}</option>
              <option value="original">{t.scan.detailOriginal}</option>
              <option value="auto">auto</option>
            </select>
          </label>
        </section>

        <section className="glass-card space-y-5 p-4 sm:p-5 md:p-6">
          <label className="block text-sm font-medium text-brand-ink dark:text-white">
            {t.settings.displayName}
            <input
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value })
                setSaved(false)
              }}
              className="field-input"
            />
          </label>

          <h2 className="font-display text-lg font-semibold text-brand-ink dark:text-white">
            {t.settings.nutritionGoals}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {goalFields.map(([key, label]) => (
              <label key={key} className="block text-sm font-medium text-brand-ink dark:text-white">
                {label}
                <input
                  type="number"
                  min={0}
                  value={form.goals[key]}
                  onChange={(e) => setGoal(key, Number(e.target.value) || 0)}
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
