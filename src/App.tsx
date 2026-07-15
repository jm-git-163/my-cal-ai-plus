import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import { OpenInChromeGate } from '@/components/OpenInChromeGate'
import { ProfileSetupGate } from '@/components/ProfileSetupGate'
import { useI18n } from '@/hooks/useI18n'
import { CoachPage } from '@/pages/CoachPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { ScanPage } from '@/pages/ScanPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { useAppStore } from '@/store/useAppStore'

export default function App() {
  const hydrate = useAppStore((s) => s.hydrate)
  const hydrated = useAppStore((s) => s.hydrated)
  const { t } = useI18n()

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (!hydrated) {
    return (
      <OpenInChromeGate>
        <div className="flex min-h-screen items-center justify-center bg-hero dark:bg-hero-dark">
          <p className="font-display text-lg font-semibold text-brand-ink dark:text-white">{t.loading}</p>
        </div>
      </OpenInChromeGate>
    )
  }

  return (
    <OpenInChromeGate>
      <ProfileSetupGate>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="scan" element={<ScanPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="coach" element={<CoachPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ProfileSetupGate>
    </OpenInChromeGate>
  )
}
