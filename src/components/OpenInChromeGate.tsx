import { useEffect, useState, type ReactNode } from 'react'
import { useI18n } from '@/hooks/useI18n'
import {
  chromeInstallUrl,
  isAndroid,
  isIOS,
  isInAppBrowser,
  isLikelyChrome,
  openInChrome,
  shouldAutoOpenChrome,
} from '@/utils/openChrome'

/**
 * When the link is opened inside KakaoTalk (or similar in-app browsers),
 * force / guide the user into Chrome so IndexedDB stays on one browser.
 */
export function OpenInChromeGate({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [blocked, setBlocked] = useState(() => {
    if (typeof navigator === 'undefined') return false
    return isInAppBrowser() && !isLikelyChrome()
  })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!shouldAutoOpenChrome()) return
    // Android: Intent redirect right away. iOS: keep gate visible (scheme may fail silently).
    openInChrome()
    const timer = window.setTimeout(() => setBlocked(true), 400)
    return () => window.clearTimeout(timer)
  }, [])

  if (!blocked) return <>{children}</>

  const appUrl = typeof window !== 'undefined' ? window.location.href : 'https://calaicnn.vercel.app'
  const installUrl = chromeInstallUrl()
  const installLabel = isIOS()
    ? t.chrome.installAppStore
    : isAndroid()
      ? t.chrome.installPlayStore
      : t.chrome.installPlayStore

  const onOpenChrome = () => {
    openInChrome(appUrl)
    setBlocked(true)
  }

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(appUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt(t.chrome.copyPrompt, appUrl)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-hero px-6 py-10 dark:bg-hero-dark">
      <div className="w-full max-w-md text-center">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          My Cal AI Plus
        </p>
        <h1 className="mt-4 font-display text-2xl font-bold text-brand-ink dark:text-white">
          {t.chrome.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {t.chrome.body}
        </p>

        <button
          type="button"
          onClick={onOpenChrome}
          className="mt-8 w-full rounded-2xl bg-brand py-3.5 text-sm font-semibold text-white shadow-soft"
        >
          {t.chrome.openButton}
        </button>

        <button
          type="button"
          onClick={() => void onCopy()}
          className="mt-3 w-full rounded-2xl border border-black/10 bg-white/80 py-3 text-sm font-semibold text-brand-ink dark:border-white/15 dark:bg-white/10 dark:text-white"
        >
          {copied ? t.chrome.copied : t.chrome.copyLink}
        </button>

        <a
          href={installUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center rounded-2xl border border-brand/30 bg-brand/10 py-3 text-sm font-semibold text-brand dark:border-brand/40 dark:bg-brand/15 dark:text-brand-green"
        >
          {installLabel}
        </a>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {t.chrome.installHint}
        </p>

        <ol className="mt-8 space-y-2 text-left text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          <li>1. {t.chrome.step1}</li>
          <li>2. {t.chrome.step2}</li>
          <li>3. {t.chrome.step3}</li>
        </ol>
      </div>
    </div>
  )
}
