import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { ActivityLevel, BiologicalSex } from '@/types'
import { NumberField } from '@/components/NumberField'
import { useI18n } from '@/hooks/useI18n'
import { useAppStore } from '@/store/useAppStore'
import { recommendDailyGoals } from '@/utils/recommendGoals'

type Step = 'guide' | 'profile'

const DISMISS_KEY = 'calai_onboarding_dismissed'

function CloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] text-brand-muted transition hover:bg-black/[0.08] hover:text-brand-ink dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/15 dark:hover:text-white"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </button>
  )
}

export function ProfileSetupGate({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)

  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  const needsGuide = !settings.guideSeen
  const needsProfile = !settings.profileSetupDone
  const shouldShow = !dismissed && (needsGuide || needsProfile)

  const [step, setStep] = useState<Step>(() => (needsGuide ? 'guide' : 'profile'))
  const [name, setName] = useState(settings.name || '')
  const [currentWeightKg, setCurrentWeightKg] = useState(settings.currentWeightKg || 65)
  const [goalWeightKg, setGoalWeightKg] = useState(settings.goalWeightKg || 60)
  const [sex, setSex] = useState<BiologicalSex>(settings.sex || 'unspecified')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(settings.activityLevel || 'light')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setStep(needsGuide ? 'guide' : 'profile')
  }, [needsGuide])

  function dismissOverlay() {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  async function markGuideSeen() {
    if (!settings.guideSeen) {
      await updateSettings({ ...settings, guideSeen: true })
    }
  }

  async function closeGuide() {
    await markGuideSeen()
    if (needsProfile) {
      setStep('profile')
      return
    }
    dismissOverlay()
  }

  async function continueFromGuide() {
    await markGuideSeen()
    setStep('profile')
  }

  function closeProfile() {
    dismissOverlay()
  }

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
        sex,
        activityLevel,
        guideSeen: true,
        profileSetupDone: true,
      }
      const rec = recommendDailyGoals(next, settings.locale === 'en' ? 'en' : 'ko')
      await updateSettings({
        ...next,
        goals: rec.goals,
        goalsFromRecommend: true,
      })
      dismissOverlay()
    } catch {
      setError(t.onboarding.saveFailed)
    } finally {
      setSaving(false)
    }
  }

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
  ]

  const guideSteps = [
    { title: t.onboarding.guideStep1Title, body: t.onboarding.guideStep1Body },
    { title: t.onboarding.guideStep2Title, body: t.onboarding.guideStep2Body },
    { title: t.onboarding.guideStep3Title, body: t.onboarding.guideStep3Body },
  ]

  return (
    <>
      {children}
      {shouldShow && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#12151c]/45 px-4 pb-6 pt-10 backdrop-blur-[6px] sm:items-center sm:pb-10 dark:bg-black/55">
          <div className="page-enter w-full max-w-[26rem]">
            {step === 'guide' ? (
              <article className="relative overflow-hidden rounded-[28px] border border-white/60 bg-gradient-to-b from-white via-white to-[#F3F8F5] shadow-[0_24px_64px_rgba(18,21,28,0.22)] dark:border-white/10 dark:from-[#141b22] dark:via-[#10161c] dark:to-[#0c1218]">
                <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-brand-green/15 blur-3xl" />
                <div className="pointer-events-none absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-brand-orange/10 blur-3xl" />
                <CloseButton onClick={() => void closeGuide()} label={t.onboarding.close} />

                <div className="relative space-y-5 px-6 pb-6 pt-7 sm:px-7 sm:pb-7">
                  <div>
                    <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-green">
                      My Cal AI Plus
                    </p>
                    <h1 className="mt-2 font-display text-[1.65rem] font-bold leading-tight tracking-tight text-brand-ink dark:text-white">
                      {t.onboarding.guideTitle}
                    </h1>
                    <p className="mt-2 text-sm leading-relaxed text-brand-muted dark:text-white/60">
                      {t.onboarding.guideIntro}
                    </p>
                  </div>

                  <ol className="space-y-3">
                    {guideSteps.map((item, i) => (
                      <li
                        key={item.title}
                        className="flex gap-3 rounded-2xl bg-white/80 p-3.5 shadow-sm ring-1 ring-black/[0.03] dark:bg-white/[0.05] dark:ring-white/10"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-green text-sm font-bold text-white">
                          {i + 1}
                        </span>
                        <div>
                          <p className="font-display text-sm font-semibold text-brand-ink dark:text-white">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-xs leading-relaxed text-brand-muted dark:text-white/55">
                            {item.body}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <button type="button" className="btn-primary w-full" onClick={() => void continueFromGuide()}>
                    {t.onboarding.guideContinue}
                  </button>
                </div>
              </article>
            ) : (
              <form
                onSubmit={(e) => void onSubmit(e)}
                className="relative overflow-hidden rounded-[28px] border border-white/60 bg-gradient-to-b from-white via-white to-[#F7F4EF] shadow-[0_24px_64px_rgba(18,21,28,0.22)] dark:border-white/10 dark:from-[#141b22] dark:via-[#10161c] dark:to-[#0c1218]"
              >
                <div className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-brand-green/12 blur-3xl" />
                <CloseButton onClick={closeProfile} label={t.onboarding.close} />

                <div className="relative space-y-4 px-6 pb-6 pt-7 sm:px-7 sm:pb-7">
                  <div>
                    <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-green">
                      {t.onboarding.profileBadge}
                    </p>
                    <h1 className="mt-2 font-display text-[1.65rem] font-bold leading-tight tracking-tight text-brand-ink dark:text-white">
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

                  <div>
                    <p className="mb-2 text-sm font-medium text-brand-ink dark:text-white">{t.settings.sex}</p>
                    <div className="flex flex-wrap gap-2">
                      {sexOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSex(opt.value)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            sex === opt.value
                              ? 'bg-brand-green text-white'
                              : 'bg-black/[0.04] text-brand-ink dark:bg-white/10 dark:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="block text-sm font-medium text-brand-ink dark:text-white">
                    {t.settings.activity}
                    <select
                      value={activityLevel}
                      onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
                      className="field-input"
                    >
                      {activityOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <p className="text-xs leading-relaxed text-brand-muted dark:text-white/45">{t.onboarding.hint}</p>

                  {error && (
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                      {error}
                    </p>
                  )}

                  <button type="submit" className="btn-primary w-full" disabled={saving}>
                    {saving ? t.onboarding.saving : t.onboarding.start}
                  </button>
                  <button
                    type="button"
                    onClick={closeProfile}
                    className="w-full text-center text-xs font-medium text-brand-muted underline-offset-2 hover:underline dark:text-white/45"
                  >
                    {t.onboarding.skipForNow}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
