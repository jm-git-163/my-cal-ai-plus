/** Detect Kakao / other in-app browsers where IndexedDB is isolated from Chrome. */
export function isInAppBrowser(ua = navigator.userAgent): boolean {
  return /KAKAOTALK|FB_IAB|FBAN|FBAV|Instagram|Line\/|NAVER\(|NaverApp|DaumApps|EverytimeApp|Band\/|Twitter/i.test(
    ua,
  )
}

export function isAndroid(ua = navigator.userAgent): boolean {
  return /Android/i.test(ua)
}

export function isIOS(ua = navigator.userAgent): boolean {
  return /iPhone|iPad|iPod/i.test(ua)
}

export function isLikelyChrome(ua = navigator.userAgent): boolean {
  if (isInAppBrowser(ua)) return false
  // Android Chrome
  if (/Chrome\//i.test(ua) && !/Edg|OPR|SamsungBrowser|Firefox/i.test(ua)) return true
  // iOS Chrome
  if (/CriOS\//i.test(ua)) return true
  return false
}

/** Android Intent URL that opens the current page in Chrome. */
export function buildAndroidChromeIntent(url = window.location.href): string {
  const withoutScheme = url.replace(/^https?:\/\//i, '')
  const scheme = url.startsWith('https') ? 'https' : 'http'
  return (
    `intent://${withoutScheme}#Intent;` +
    `scheme=${scheme};` +
    `package=com.android.chrome;` +
    `S.browser_fallback_url=${encodeURIComponent(url)};` +
    `end`
  )
}

/** iOS Chrome custom URL scheme (requires Chrome installed). */
export function buildIosChromeUrl(url = window.location.href): string {
  if (url.startsWith('https://')) {
    return `googlechromes://${url.slice('https://'.length)}`
  }
  if (url.startsWith('http://')) {
    return `googlechrome://${url.slice('http://'.length)}`
  }
  return url
}

const REDIRECT_KEY = 'calai_chrome_redirect_ts'

export function shouldAutoOpenChrome(): boolean {
  if (typeof window === 'undefined') return false
  if (isLikelyChrome()) return false
  if (!isInAppBrowser()) return false
  // Avoid tight redirect loops within 8s
  try {
    const last = Number(sessionStorage.getItem(REDIRECT_KEY) || 0)
    if (Date.now() - last < 8000) return false
  } catch {
    /* ignore */
  }
  return true
}

export function markChromeRedirectAttempted(): void {
  try {
    sessionStorage.setItem(REDIRECT_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

/** Try to leave the in-app browser for Chrome. Returns true if navigation was triggered. */
export function openInChrome(url = window.location.href): boolean {
  markChromeRedirectAttempted()
  if (isAndroid()) {
    window.location.href = buildAndroidChromeIntent(url)
    return true
  }
  if (isIOS()) {
    window.location.href = buildIosChromeUrl(url)
    return true
  }
  return false
}
