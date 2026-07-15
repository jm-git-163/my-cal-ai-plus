import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useI18n } from '@/hooks/useI18n'
import { useAppStore } from '@/store/useAppStore'

function IconHome({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.7}
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconScan() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 4H5a1 1 0 0 0-1 1v2M17 4h2a1 1 0 0 1 1 1v2M7 20H5a1 1 0 0 1-1-1v-2M17 20h2a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function IconHistory({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M4 12h10M4 17h14" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" />
    </svg>
  )
}

function IconCoach({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3c2.5 3 4 5.2 4 8a4 4 0 1 1-8 0c0-2.8 1.5-5 4-8Z"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
        strokeLinejoin="round"
      />
      <path d="M9 20h6" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" />
    </svg>
  )
}

function IconSettings({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.5M17.5 16l1.6 1.5M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.5M17.5 8l1.6-1.5"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.7}
        strokeLinecap="round"
      />
    </svg>
  )
}

export function AppLayout() {
  const { t, locale } = useI18n()
  const theme = useAppStore((s) => s.settings.theme)
  const setLocale = useAppStore((s) => s.setLocale)
  const setTheme = useAppStore((s) => s.setTheme)
  const location = useLocation()

  const sideLinks = [
    { to: '/', label: t.nav.dashboard, end: true, Icon: IconHome },
    { to: '/history', label: t.nav.history, end: false, Icon: IconHistory },
    { to: '/coach', label: t.nav.coach, end: false, Icon: IconCoach },
    { to: '/settings', label: t.nav.settings, end: false, Icon: IconSettings },
  ]

  return (
    <div className="min-h-screen bg-hero dark:bg-hero-dark">
      <header className="sticky top-0 z-30 border-b border-black/[0.04] bg-white/80 backdrop-blur-2xl dark:border-white/[0.06] dark:bg-[#07090c]/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-green text-white shadow-[0_8px_20px_rgba(34,160,107,0.35)]">
              <span className="font-display text-lg font-bold">+</span>
            </div>
            <div className="min-w-0">
              <p className="font-display text-[15px] font-bold tracking-tight text-brand-ink dark:text-white sm:text-lg">
                My Cal AI Plus
              </p>
              <p className="hidden text-[11px] text-brand-muted dark:text-white/45 sm:block">{t.brandTagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex rounded-full bg-black/[0.04] p-0.5 dark:bg-white/10">
              <button
                type="button"
                onClick={() => void setLocale('ko')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                  locale === 'ko'
                    ? 'bg-white text-brand-ink shadow-sm dark:bg-white/20 dark:text-white'
                    : 'text-brand-muted'
                }`}
              >
                KO
              </button>
              <button
                type="button"
                onClick={() => void setLocale('en')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                  locale === 'en'
                    ? 'bg-white text-brand-ink shadow-sm dark:bg-white/20 dark:text-white'
                    : 'text-brand-muted'
                }`}
              >
                EN
              </button>
            </div>
            <button
              type="button"
              onClick={() => void setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.04] text-sm dark:bg-white/10"
              aria-label={theme === 'dark' ? t.themeLight : t.themeDark}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <nav className="ml-1 hidden items-center gap-1 md:flex">
              {sideLinks.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    `rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-brand-green text-white shadow-sm'
                        : 'text-brand-muted hover:bg-black/[0.04] hover:text-brand-ink dark:hover:bg-white/10 dark:hover:text-white'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
              <NavLink
                to="/scan"
                className={({ isActive }) =>
                  `ml-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-brand-ink text-white dark:bg-white dark:text-brand-ink'
                      : 'bg-brand-green text-white shadow-[0_8px_20px_rgba(34,160,107,0.3)]'
                  }`
                }
              >
                {t.nav.scan}
              </NavLink>
            </nav>
          </div>
        </div>
      </header>

      <main key={location.pathname} className="page-enter mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-9">
        <Outlet />
      </main>

      {/* Mobile tab bar with center shutter FAB */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.05] bg-white/92 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[#07090c]/94 md:hidden">
        <div className="relative mx-auto grid max-w-lg grid-cols-5 items-end px-1 pb-1 pt-1 safe-bottom">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${isActive ? 'text-brand-green' : 'text-brand-muted'}`
            }
          >
            {({ isActive }) => (
              <>
                <IconHome active={isActive} />
                <span>{t.nav.dashboard}</span>
              </>
            )}
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${isActive ? 'text-brand-green' : 'text-brand-muted'}`
            }
          >
            {({ isActive }) => (
              <>
                <IconHistory active={isActive} />
                <span>{t.nav.history}</span>
              </>
            )}
          </NavLink>

          <div className="relative flex justify-center">
            <NavLink to="/scan" className="fab-scan scan-pulse" aria-label={t.nav.scan}>
              <IconScan />
            </NavLink>
          </div>

          <NavLink
            to="/coach"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${isActive ? 'text-brand-green' : 'text-brand-muted'}`
            }
          >
            {({ isActive }) => (
              <>
                <IconCoach active={isActive} />
                <span>{t.nav.coach}</span>
              </>
            )}
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${isActive ? 'text-brand-green' : 'text-brand-muted'}`
            }
          >
            {({ isActive }) => (
              <>
                <IconSettings active={isActive} />
                <span>{t.nav.settings}</span>
              </>
            )}
          </NavLink>
        </div>
      </nav>
      <div className="h-24 md:hidden" />
    </div>
  )
}
