/** Compact 1:1 share card — exact text, dense layout. */

export interface ShareCardInput {
  headline: string
  subtitle: string
  score?: number
  locale?: 'ko' | 'en'
}

/** Bump when layout changes so the app clears stale previews. */
export const SHARE_CARD_DESIGN = 4

/** Square feed card — no tall empty regions. */
const W = 1080
const H = 1080

export function clipShareText(text: string, maxChars: number): string {
  const raw = text.replace(/\s+/g, ' ').trim()
  if (!raw) return ''
  const chars = [...raw]
  if (chars.length <= maxChars) return raw

  const window = chars.slice(0, maxChars).join('')
  const candidates = [
    window.lastIndexOf('. '),
    window.lastIndexOf('! '),
    window.lastIndexOf('? '),
    window.lastIndexOf('。'),
    window.lastIndexOf('요.'),
    window.lastIndexOf('다.'),
    window.lastIndexOf('요 '),
    window.lastIndexOf('다 '),
    window.lastIndexOf(' · '),
    window.lastIndexOf(' — '),
    window.lastIndexOf(', '),
    window.lastIndexOf(' '),
  ]
  const breakAt = Math.max(...candidates)
  if (breakAt > maxChars * 0.45) {
    return window.slice(0, breakAt + (window[breakAt] === ' ' ? 0 : 1)).trimEnd()
  }
  return `${chars.slice(0, Math.max(1, maxChars - 1)).join('').trimEnd()}…`
}

function wrapByWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const tokens = text.match(/\S+\s*|\s+/g) ?? [text]
  const lines: string[] = []
  let line = ''

  for (const token of tokens) {
    const test = line + token
    if (ctx.measureText(test).width <= maxWidth) {
      line = test
      continue
    }
    if (line.trim()) {
      lines.push(line.trimEnd())
      if (lines.length >= maxLines) {
        ellipsizeLast(ctx, lines, maxWidth)
        return lines
      }
      if (ctx.measureText(token.trim()).width > maxWidth) {
        const chars = [...token.trim()]
        let chunk = ''
        for (const ch of chars) {
          if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
            lines.push(chunk)
            chunk = ch
            if (lines.length >= maxLines) {
              ellipsizeLast(ctx, lines, maxWidth)
              return lines
            }
          } else {
            chunk += ch
          }
        }
        line = chunk
      } else {
        line = token.trimStart()
      }
    } else {
      const chars = [...token]
      let chunk = ''
      for (const ch of chars) {
        if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
          lines.push(chunk)
          chunk = ch
          if (lines.length >= maxLines) {
            ellipsizeLast(ctx, lines, maxWidth)
            return lines
          }
        } else {
          chunk += ch
        }
      }
      line = chunk
    }
  }
  if (line.trim() && lines.length < maxLines) lines.push(line.trimEnd())
  return lines.slice(0, maxLines)
}

function ellipsizeLast(ctx: CanvasRenderingContext2D, lines: string[], maxWidth: number) {
  let last = lines[lines.length - 1]
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
    last = [...last].slice(0, -1).join('')
  }
  lines[lines.length - 1] = last.endsWith('…') ? last : `${last}…`
}

async function ensureFonts() {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  await Promise.all([
    document.fonts.load('700 72px Outfit'),
    document.fonts.load('700 44px "Noto Sans KR"'),
    document.fonts.load('500 28px "Noto Sans KR"'),
    document.fonts.load('600 24px "DM Sans"'),
  ]).catch(() => undefined)
  await document.fonts.ready.catch(() => undefined)
}

function scoreAccent(score: number): string {
  if (score >= 85) return '#22A06B'
  if (score >= 70) return '#3DCF8A'
  if (score >= 40) return '#E88B2E'
  return '#E05A4C'
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  score: number,
) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(26,31,44,0.08)'
  ctx.lineWidth = 12
  ctx.stroke()
  const start = -Math.PI / 2
  ctx.beginPath()
  ctx.arc(cx, cy, r, start, start + (score / 100) * Math.PI * 2)
  ctx.strokeStyle = scoreAccent(score)
  ctx.lineWidth = 12
  ctx.lineCap = 'round'
  ctx.stroke()
}

/** Dense square share card (PNG). */
export async function renderShareCard(input: ShareCardInput): Promise<string> {
  await ensureFonts()

  const locale = input.locale === 'en' ? 'en' : 'ko'
  const headline = clipShareText(input.headline || 'My Cal AI Plus', 42)
  const subtitle = clipShareText(input.subtitle || '', 64)
  const score =
    typeof input.score === 'number' && Number.isFinite(input.score)
      ? Math.min(100, Math.max(0, Math.round(input.score)))
      : null

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#DFF5E9')
  bg.addColorStop(0.5, '#F2FAF5')
  bg.addColorStop(1, '#FFEFD9')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Solid card fill edge-to-edge with small inset
  const inset = 36
  roundRect(ctx, inset, inset, W - inset * 2, H - inset * 2, 36)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()

  // Top brand strip
  roundRect(ctx, inset, inset, W - inset * 2, 88, 36)
  ctx.fillStyle = '#22A06B'
  ctx.fill()
  // square bottom of strip
  ctx.fillRect(inset, inset + 44, W - inset * 2, 44)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = '700 30px Outfit, sans-serif'
  ctx.fillText('My Cal AI Plus', inset + 40, inset + 56)

  const pad = 52
  const x0 = inset + pad
  const contentW = W - inset * 2 - pad * 2
  let y = inset + 88 + 44

  // Score row
  if (score !== null) {
    const cx = x0 + 70
    const cy = y + 70
    drawRing(ctx, cx, cy, 62, score)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#1A1F2C'
    ctx.font = '700 48px Outfit, sans-serif'
    ctx.fillText(String(score), cx, cy + 14)
    ctx.fillStyle = '#6B7280'
    ctx.font = '600 18px Outfit, sans-serif'
    ctx.fillText('/100', cx, cy + 38)
    ctx.textAlign = 'left'

    const tx = cx + 90
    ctx.fillStyle = '#6B7280'
    ctx.font = '600 22px "Noto Sans KR", sans-serif'
    ctx.fillText(locale === 'en' ? 'Nutrition score' : '영양 점수', tx, cy - 28)

    ctx.fillStyle = '#1A1F2C'
    ctx.font = '700 40px "Noto Sans KR", Outfit, sans-serif'
    ctx.fillText(
      locale === 'en' ? `${score} / 100` : `${score}점 / 100점`,
      tx,
      cy + 16,
    )

    ctx.fillStyle = scoreAccent(score)
    ctx.font = '600 22px "Noto Sans KR", sans-serif'
    ctx.fillText(
      locale === 'en' ? 'out of 100 points' : '100점 만점 기준',
      tx,
      cy + 48,
    )

    // bar
    const barY = cy + 86
    roundRect(ctx, x0, barY, contentW, 12, 6)
    ctx.fillStyle = 'rgba(26,31,44,0.07)'
    ctx.fill()
    roundRect(ctx, x0, barY, Math.max(10, (contentW * score) / 100), 12, 6)
    ctx.fillStyle = scoreAccent(score)
    ctx.fill()
    y = barY + 40
  }

  // Headline
  ctx.fillStyle = '#1A1F2C'
  ctx.font = '700 38px "Noto Sans KR", Outfit, sans-serif'
  for (const line of wrapByWidth(ctx, headline, contentW, 3)) {
    ctx.fillText(line, x0, y)
    y += 48
  }
  y += 16

  // Subtitle box
  if (subtitle) {
    ctx.font = '500 26px "Noto Sans KR", sans-serif'
    const lines = wrapByWidth(ctx, subtitle, contentW - 40, 3)
    const boxH = 28 + lines.length * 36
    roundRect(ctx, x0, y, contentW, boxH, 20)
    ctx.fillStyle = 'rgba(34,160,107,0.09)'
    ctx.fill()
    ctx.fillStyle = 'rgba(26,31,44,0.8)'
    let sy = y + 34
    for (const line of lines) {
      ctx.fillText(line, x0 + 20, sy)
      sy += 36
    }
    y = y + boxH + 20
  }

  // Footer bar
  const footTop = H - inset - 78
  ctx.fillStyle = 'rgba(34,160,107,0.08)'
  ctx.fillRect(inset, footTop, W - inset * 2, 78)
  ctx.fillStyle = '#1A7A52'
  ctx.font = '600 24px "Noto Sans KR", Outfit, sans-serif'
  ctx.fillText(
    locale === 'en' ? 'Keep going — one meal at a time' : '한 끼씩, 꾸준히 가면 됩니다',
    x0,
    footTop + 34,
  )
  ctx.fillStyle = 'rgba(26,31,44,0.4)'
  ctx.font = '500 20px "DM Sans", sans-serif'
  ctx.fillText('calaicnn.vercel.app', x0, footTop + 60)

  return canvas.toDataURL('image/png')
}
