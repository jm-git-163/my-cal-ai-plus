import { useEffect, useState } from 'react'

type Mode = 'recommend' | 'coach' | 'scan'

interface CoachWaitPanelProps {
  mode: Mode
  title: string
  stages: readonly string[]
  tips: readonly string[]
  almost: string
  hint: string
  tipLabel: string
  /** Seconds before switching stage copy to “almost”. Default 6. */
  almostAfterSec?: number
}

export function CoachWaitPanel({
  mode,
  title,
  stages,
  tips,
  almost,
  hint,
  tipLabel,
  almostAfterSec = 6,
}: CoachWaitPanelProps) {
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * Math.max(tips.length, 1)))
  const [stageIndex, setStageIndex] = useState(0)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [tipVisible, setTipVisible] = useState(true)

  useEffect(() => {
    const started = Date.now()
    const tick = window.setInterval(() => {
      const sec = Math.floor((Date.now() - started) / 1000)
      setElapsedSec(sec)
      if (sec < 1) setStageIndex(0)
      else if (sec < 3) setStageIndex(Math.min(1, stages.length - 1))
      else setStageIndex(Math.min(2, stages.length - 1))
    }, 280)
    return () => window.clearInterval(tick)
  }, [stages.length])

  useEffect(() => {
    if (tips.length < 2) return
    let fadeTimer: number | undefined
    // Slow enough to read a full tip (~1–2 sentences).
    const rotate = window.setInterval(() => {
      setTipVisible(false)
      fadeTimer = window.setTimeout(() => {
        setTipIndex((i) => (i + 1) % tips.length)
        setTipVisible(true)
      }, 320)
    }, 8000)
    return () => {
      window.clearInterval(rotate)
      if (fadeTimer) window.clearTimeout(fadeTimer)
    }
  }, [tips.length])

  const stage = stages[Math.min(stageIndex, stages.length - 1)] ?? ''
  const tip = tips[tipIndex % Math.max(tips.length, 1)] ?? ''
  const showAlmost = elapsedSec >= almostAfterSec

  return (
    <section
      className="coach-wait glass-card overflow-hidden p-5 sm:p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-start gap-4">
        <div className={`coach-wait__orb coach-wait__orb--${mode}`} aria-hidden>
          <span className="coach-wait__core" />
          <span className="coach-wait__ring" />
          <span className="coach-wait__spark coach-wait__spark--a" />
          <span className="coach-wait__spark coach-wait__spark--b" />
          <span className="coach-wait__spark coach-wait__spark--c" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-semibold text-brand-green">{title}</p>
          <p className="font-display text-lg font-semibold leading-snug text-brand-ink dark:text-white">
            {showAlmost ? almost : stage}
          </p>
          <p className="text-xs text-brand-muted dark:text-white/50">{hint}</p>
        </div>
      </div>

      <div className="coach-wait__bar mt-4" aria-hidden>
        <span className="coach-wait__bar-fill" />
      </div>

      <div
        className={`mt-4 rounded-2xl bg-brand-green-soft/80 px-4 py-3 transition-opacity duration-200 dark:bg-brand-green/15 ${
          tipVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-green/80 dark:text-brand-green">
          {tipLabel}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-brand-ink dark:text-white/85">{tip}</p>
      </div>
    </section>
  )
}
