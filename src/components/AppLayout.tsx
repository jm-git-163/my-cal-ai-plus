import { NavLink, Outlet } from 'react-router-dom'
import { useI18n } from '@/hooks/useI18n'
import { useAppStore } from '@/store/useAppStore'

export function AppLayout() {
  const { t, locale } = useI18n()
  const theme = useAppStore((s) => s.settings.theme)
  const setLocale = useAppStore((s) => s.setLocale)
  const setTheme = useAppStore((s) => s.setTheme)

  const links = [
    { to: '/', label: t.nav.dashboard, end: true },
    { to: '/scan', label: t.nav.scan, end: false },
    { to: '/history', label: t.nav.history, end: false },
    { to: '/coach', label: t.nav.coach, end: false },
    { to: '/settings', label: t.nav.settings, end: false },
  ]

  return (
    <div className="min-h-screen bg-hero dark:bg-hero-dark">
      <header className="sticky top-0 z-20 border-b border-white/50 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-[#121820]/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-green text-white shadow-soft">
              <span className="font-display text-lg font-bold">C</span>
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg font-bold leading-tight tracking-tight text-brand-ink dark:text-white">
                My Cal AI Plus
              </p>
              <p className="truncate text-xs text-brand-muted dark:text-white/55">{t.brandTagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <div className="flex rounded-xl bg-black/5 p-0.5 dark:bg-white/10">
              <button
                type="button"
                onClick={() => void setLocale('ko')}
                className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
                  locale === 'ko'
                    ? 'bg-white text-brand-ink shadow-sm dark:bg-white/20 dark:text-white'
                    : 'text-brand-muted dark:text-white/50'
                }`}
                aria-label="한국어"
              >
                KO
              </button>
              <button
                type="button"
                onClick={() => void setLocale('en')}
                className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
                  locale === 'en'
                    ? 'bg-white text-brand-ink shadow-sm dark:bg-white/20 dark:text-white'
                    : 'text-brand-muted dark:text-white/50'
                }`}
                aria-label="English"
              >
                EN
              </button>
            </div>
            <button
              type="button"
              onClick={() => void setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-xl bg-black/5 px-2.5 py-1.5 text-xs font-semibold text-brand-ink transition hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              aria-label={theme === 'dark' ? t.themeLight : t.themeDark}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <nav className="ml-1 hidden items-center gap-1 sm:flex">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    `rounded-xl px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-brand-green-soft text-brand-green dark:bg-brand-green/20 dark:text-brand-green'
                        : 'text-brand-muted hover:bg-white/80 hover:text-brand-ink dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/60 bg-white/85 backdrop-blur-xl dark:border-white/10 dark:bg-[#121820]/90 sm:hidden">
        <div className="mx-auto flex max-w-5xl justify-around px-2 py-2">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center rounded-xl px-2 py-2 text-[11px] font-semibold ${
                  isActive ? 'text-brand-green' : 'text-brand-muted dark:text-white/50'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <div className="h-20 sm:hidden" />
    </div>
  )
}
