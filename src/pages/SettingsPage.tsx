import { useEffect, useState, type FormEvent } from 'react'
import type { DailyGoals, UserSettings } from '@/types'
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
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-brand-ink dark:text-white">
          {t.settings.title}
        </h1>
        <p className="mt-1 text-brand-muted dark:text-white/60">{t.settings.subtitle}</p>
      </div>

      <section className="glass-card space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-brand-ink dark:text-white">
          {t.settings.appearance}
        </h2>
        <div>
          <p className="mb-2 text-sm font-medium text-brand-ink dark:text-white">{t.language}</p>
          <div className="flex gap-2">
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
          <div className="flex gap-2">
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

      <form onSubmit={(e) => void onSubmit(e)} className="glass-card space-y-5 p-5 sm:p-6">
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

        <div className="grid grid-cols-2 gap-3">
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
      </form>
    </div>
  )
}
