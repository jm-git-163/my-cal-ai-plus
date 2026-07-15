import { NavLink, Outlet } from 'react-router-dom'
import { useI18n } from '@/hooks/useI18n'
import { useAppStore } from '@/store/useAppStore'

export function AppLayout() {
  const { t, locale } = useI18n()
  const theme = useAppStore((s) => s.settings.theme)
  const setLocale = useAppStore((s) => s.setLocale)
  const setTheme = useAppStore((s) => s.setTheme)

  const links = [
    { to: '/', label: t.nav.dashboard, short: 'Home', end: true },
    { to: '/scan', label: t.nav.scan, short: 'Scan', end: false },
    { to: '/history', label: t.nav.history, short: 'Log', end: false },
    { to: '/coach', label: t.nav.coach, short: 'Coach', end: false },
    { to: '/settings', label: t.nav.settings, short: 'Set', end: false },
  ]

  return (
    <div className="min-h-screen bg-hero dark:bg-hero-dark">
      <header className="sticky top-0 z-20 border-b border-white/50 bg-white/75 backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1419]/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-green text-white shadow-soft sm:h-11 sm:w-11">
              <span className="font-display text-lg font-bold">C</span>
            </div>
            <div className="min-w-0">
              <p className="font-display text-base font-bold leading-tight tracking-tight text-brand-ink dark:text-white sm:text-lg">
                My Cal AI Plus
              </p>
              <p className="hidden truncate text-xs text-brand-muted dark:text-white/55 xs:block sm:block">
                {t.brandTagline}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
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
            <nav className="ml-1 hidden items-center gap-1 md:flex lg:gap-1.5">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    `rounded-xl px-3 py-2 text-sm font-medium transition lg:px-3.5 ${
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

      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7 md:py-8 lg:px-8 lg:py-10">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/60 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1419]/92 md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5 px-1 py-1.5 safe-bottom">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] font-semibold leading-tight ${
                  isActive ? 'bg-brand-green-soft/80 text-brand-green dark:bg-brand-green/20' : 'text-brand-muted dark:text-white/50'
                }`
              }
            >
              <span className="max-w-full truncate">{l.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
      <div className="h-[4.5rem] md:hidden" />
    </div>
  )
}
