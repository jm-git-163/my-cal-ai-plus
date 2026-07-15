import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

/**
 * After a deploy, a cached index.html can point at deleted hashed /assets/*.js
 * → blank screen. Reload once so the browser picks up the new entry.
 */
function reloadOnceForStaleAssets(reason: string) {
  try {
    const key = 'calai.staleAssetReload'
    if (sessionStorage.getItem(key) === '1') return
    sessionStorage.setItem(key, '1')
    console.warn('[calai] reloading for stale assets:', reason)
    window.location.reload()
  } catch {
    window.location.reload()
  }
}

const STALE_ASSET =
  /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

window.addEventListener('error', (ev) => {
  const msg = String(ev.message || '')
  const src = String((ev as ErrorEvent).filename || '')
  if (STALE_ASSET.test(msg) || (/\/assets\//.test(src) && /404|Failed to load/i.test(msg))) {
    reloadOnceForStaleAssets(msg || src)
  }
})

window.addEventListener('unhandledrejection', (ev) => {
  const reason = ev.reason
  const msg = String(reason?.message || reason || '')
  if (STALE_ASSET.test(msg)) {
    reloadOnceForStaleAssets(msg)
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
