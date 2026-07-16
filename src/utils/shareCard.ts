/** Compact share card — exact text, tight layout (no sparse empty canvas). */

export interface ShareCardInput {
  headline: string
  subtitle: string
  score?: number
  locale?: 'ko' | 'en'
}

/** Feed-friendly 4:5 — shorter than stories so the canvas doesn’t feel empty. */
const W = 1080
const H = 1350

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
    document.fonts.load('600 40px Outfit'),
    document.fonts.load('700 44px "Noto Sans KR"'),
    document.fonts.load('500 30px "Noto Sans KR"'),
    document.fonts.load('600 26px "DM Sans"'),
  ]).catch(() => undefined)
  await document.fonts.ready.catch(() => undefined)
}

function scoreAccent(score: number): string {
  if (score >= 85) return '#22A06B'
  if (score >= 70) return '#3DCF8A'
  if (score >= 40) return '#E88B2E'
  return '#E05A4C'
}

function drawScoreRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  score: number,
  stroke = 16,
) {
  const accent = scoreAccent(score)
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(26, 31, 44, 0.08)'
  ctx.lineWidth = stroke
  ctx.stroke()

  const pct = Math.max(0, Math.min(1, score / 100))
  const start = -Math.PI / 2
  ctx.beginPath()
  ctx.arc(cx, cy, r, start, start + pct * Math.PI * 2)
  ctx.strokeStyle = accent
  ctx.lineWidth = stroke
  ctx.lineCap = 'round'
  ctx.stroke()
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

/**
 * Compact branded share card (PNG data URL).
 * Dense 4:5 card — score row + copy + footer, minimal dead space.
 */
export async function renderShareCard(input: ShareCardInput): Promise<string> {
  await ensureFonts()

  const locale = input.locale === 'en' ? 'en' : 'ko'
  const headline = clipShareText(input.headline || 'My Cal AI Plus', 48)
  const subtitle = clipShareText(input.subtitle || '', 72)
  const score =
    typeof input.score === 'number' && Number.isFinite(input.score)
      ? Math.min(100, Math.max(0, Math.round(input.score)))
      : null

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  // Soft brand wash
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#E4F6EC')
  bg.addColorStop(0.55, '#F4FAF6')
  bg.addColorStop(1, '#FFF4E8')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Inner white panel — fills most of the canvas (tight margins)
  const m = 48
  const panelX = m
  const panelY = m
  const panelW = W - m * 2
  const panelH = H - m * 2
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'
  roundRect(ctx, panelX, panelY, panelW, panelH, 40)
  ctx.fill()
  ctx.strokeStyle = 'rgba(34, 160, 107, 0.16)'
  ctx.lineWidth = 2
  roundRect(ctx, panelX, panelY, panelW, panelH, 40)
  ctx.stroke()

  // Corner accent blobs (inside panel, subtle fill)
  const blob = (x: number, y: number, r: number, c: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, c)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  blob(panelX + 80, panelY + 80, 160, 'rgba(34, 160, 107, 0.1)')
  blob(panelX + panelW - 60, panelY + 100, 140, 'rgba(232, 139, 46, 0.1)')

  const pad = 56
  const x0 = panelX + pad
  const contentW = panelW - pad * 2
  let y = panelY + pad + 8

  // Brand row
  ctx.fillStyle = '#22A06B'
  ctx.font = '700 26px Outfit, "Noto Sans KR", sans-serif'
  ctx.fillText('My Cal AI Plus', x0, y)
  ctx.fillStyle = 'rgba(26, 31, 44, 0.4)'
  ctx.font = '500 22px "DM Sans", "Noto Sans KR", sans-serif'
  const tag = locale === 'en' ? 'Snap · Analyze · Coach' : '스냅 · 분석 · 코치'
  const tagW = ctx.measureText(tag).width
  ctx.fillText(tag, x0 + contentW - tagW, y)
  y += 28

  // Divider
  ctx.strokeStyle = 'rgba(34, 160, 107, 0.14)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x0, y)
  ctx.lineTo(x0 + contentW, y)
  ctx.stroke()
  y += 36

  // Score block — horizontal, compact
  if (score !== null) {
    const ringR = 78
    const cx = x0 + ringR + 8
    const cy = y + ringR + 4
    drawScoreRing(ctx, cx, cy, ringR, score, 14)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#1A1F2C'
    ctx.font = '700 64px Outfit, sans-serif'
    ctx.fillText(String(score), cx, cy + 18)
    ctx.fillStyle = '#6B7280'
    ctx.font = '600 22px Outfit, sans-serif'
    ctx.fillText('/100', cx, cy + 46)
    ctx.textAlign = 'left'

    const textX = cx + ringR + 36
    const textMax = x0 + contentW - textX
    ctx.fillStyle = '#6B7280'
    ctx.font = '600 24px "Noto Sans KR", "DM Sans", sans-serif'
    ctx.fillText(locale === 'en' ? 'Nutrition score' : '영양 점수', textX, cy - 36)

    ctx.fillStyle = '#1A1F2C'
    ctx.font = '700 44px "Noto Sans KR", Outfit, sans-serif'
    const outOf =
      locale === 'en' ? `${score} / 100 points` : `${score}점 / 100점 만점`
    const outLines = wrapByWidth(ctx, outOf, textMax, 2)
    let ty = cy + 8
    for (const line of outLines) {
      ctx.fillText(line, textX, ty)
      ty += 52
    }

    // Progress bar under score row
    const barY = cy + ringR + 28
    const barH = 14
    roundRect(ctx, x0, barY, contentW, barH, 7)
    ctx.fillStyle = 'rgba(26, 31, 44, 0.06)'
    ctx.fill()
    const filled = Math.max(8, (contentW * score) / 100)
    roundRect(ctx, x0, barY, filled, barH, 7)
    ctx.fillStyle = scoreAccent(score)
    ctx.fill()

    y = barY + barH + 40
  }

  // Headline
  ctx.fillStyle = '#1A1F2C'
  ctx.font = '700 42px "Noto Sans KR", Outfit, sans-serif'
  const headLines = wrapByWidth(ctx, headline, contentW, 3)
  for (const line of headLines) {
    ctx.fillText(line, x0, y)
    y += 54
  }
  y += 20

  // Subtitle in soft chip panel
  if (subtitle) {
    const subFont = '500 28px "Noto Sans KR", "DM Sans", sans-serif'
    ctx.font = subFont
    const subLines = wrapByWidth(ctx, subtitle, contentW - 48, 3)
    const boxH = 36 + subLines.length * 40
    roundRect(ctx, x0, y, contentW, boxH, 24)
    ctx.fillStyle = 'rgba(34, 160, 107, 0.08)'
    ctx.fill()

    ctx.fillStyle = 'rgba(26, 31, 44, 0.78)'
    ctx.font = subFont
    let sy = y + 40
    for (const line of subLines) {
      ctx.fillText(line, x0 + 24, sy)
      sy += 40
    }
    y = y + boxH + 28
  }

  // Footer pinned near bottom of panel
  const footY = panelY + panelH - 72
  ctx.strokeStyle = 'rgba(34, 160, 107, 0.14)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x0, footY - 28)
  ctx.lineTo(x0 + contentW, footY - 28)
  ctx.stroke()

  ctx.fillStyle = '#1A7A52'
  ctx.font = '600 26px "Noto Sans KR", Outfit, sans-serif'
  ctx.fillText(
    locale === 'en' ? 'Keep going — one meal at a time' : '한 끼씩, 꾸준히 가면 됩니다',
    x0,
    footY,
  )
  ctx.fillStyle = 'rgba(26, 31, 44, 0.4)'
  ctx.font = '500 22px "DM Sans", sans-serif'
  ctx.fillText('calaicnn.vercel.app', x0, footY + 34)

  return canvas.toDataURL('image/png')
}
