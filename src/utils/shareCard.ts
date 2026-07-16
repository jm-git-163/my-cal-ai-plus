/** Client-side share card — real text (no AI typography / mid-slice glitches). */

export interface ShareCardInput {
  headline: string
  subtitle: string
  score?: number
  locale?: 'ko' | 'en'
}

const W = 1080
const H = 1350

/** Truncate on grapheme boundaries; prefer sentence / word ends. Never mid-byte slice. */
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
  // Prefer wrapping at spaces / punctuation so Korean phrases stay intact.
  const tokens = text.match(/\S+\s*|\s+/g) ?? [text]
  const lines: string[] = []
  let line = ''

  const pushLine = (next: string) => {
    lines.push(line)
    line = next
  }

  for (const token of tokens) {
    const test = line + token
    if (ctx.measureText(test).width <= maxWidth) {
      line = test
      continue
    }
    if (line.trim()) {
      pushLine('')
      // token itself may be longer than maxWidth — fall back to grapheme wrap
      if (ctx.measureText(token.trim()).width > maxWidth) {
        const chars = [...token.trim()]
        let chunk = ''
        for (const ch of chars) {
          if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
            lines.push(chunk)
            chunk = ch
            if (lines.length >= maxLines) break
          } else {
            chunk += ch
          }
        }
        line = chunk
      } else {
        line = token.trimStart()
      }
    } else {
      // Single oversized token
      const chars = [...token]
      let chunk = ''
      for (const ch of chars) {
        if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
          lines.push(chunk)
          chunk = ch
          if (lines.length >= maxLines) break
        } else {
          chunk += ch
        }
      }
      line = chunk
    }
    if (lines.length >= maxLines) {
      let last = lines[lines.length - 1]
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
        last = [...last].slice(0, -1).join('')
      }
      lines[lines.length - 1] = last.endsWith('…') ? last : `${last}…`
      return lines.slice(0, maxLines)
    }
  }
  if (line.trim() && lines.length < maxLines) lines.push(line.trimEnd())
  return lines.slice(0, maxLines)
}

async function ensureFonts() {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  await Promise.all([
    document.fonts.load('700 72px Outfit'),
    document.fonts.load('600 48px "Noto Sans KR"'),
    document.fonts.load('500 36px "Noto Sans KR"'),
    document.fonts.load('600 40px "DM Sans"'),
  ]).catch(() => undefined)
  await document.fonts.ready.catch(() => undefined)
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
 * Renders a branded share card as a PNG data URL.
 * Text is drawn with canvas fonts — spelling matches the coach copy exactly.
 */
export async function renderShareCard(input: ShareCardInput): Promise<string> {
  await ensureFonts()

  const locale = input.locale === 'en' ? 'en' : 'ko'
  const headline = clipShareText(input.headline || (locale === 'en' ? 'My Cal AI Plus' : 'My Cal AI Plus'), 72)
  const subtitle = clipShareText(input.subtitle || '', 110)
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
  bg.addColorStop(0, '#E8F8EF')
  bg.addColorStop(0.45, '#F3FAF5')
  bg.addColorStop(1, '#FFF6EC')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Soft blobs
  ctx.fillStyle = 'rgba(34, 160, 107, 0.18)'
  ctx.beginPath()
  ctx.ellipse(120, 80, 280, 220, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(232, 139, 46, 0.14)'
  ctx.beginPath()
  ctx.ellipse(980, 160, 240, 200, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(47, 111, 237, 0.1)'
  ctx.beginPath()
  ctx.ellipse(700, 1200, 320, 220, 0, 0, Math.PI * 2)
  ctx.fill()

  // Card panel
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
  roundRect(ctx, 64, 96, W - 128, H - 220, 48)
  ctx.fill()
  ctx.strokeStyle = 'rgba(34, 160, 107, 0.22)'
  ctx.lineWidth = 3
  roundRect(ctx, 64, 96, W - 128, H - 220, 48)
  ctx.stroke()

  const padX = 120
  const contentW = W - padX * 2
  let y = 160

  // Brand
  ctx.fillStyle = '#22A06B'
  ctx.font = '700 36px Outfit, "Noto Sans KR", sans-serif'
  ctx.fillText('My Cal AI Plus', padX, y)
  y += 36
  ctx.fillStyle = '#6B7280'
  ctx.font = '500 28px "DM Sans", "Noto Sans KR", sans-serif'
  ctx.fillText(locale === 'en' ? 'Snap · Analyze · Coach · Improve' : '스냅 · 분석 · 코치 · 성장', padX, y)
  y += 70

  // Score badge
  if (score !== null) {
    const cx = padX + 90
    const cy = y + 90
    ctx.beginPath()
    ctx.arc(cx, cy, 88, 0, Math.PI * 2)
    ctx.fillStyle = '#E8F6EF'
    ctx.fill()
    ctx.strokeStyle = '#22A06B'
    ctx.lineWidth = 6
    ctx.stroke()

    ctx.fillStyle = '#22A06B'
    ctx.font = '700 64px Outfit, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(score), cx, cy + 22)
    ctx.font = '600 24px "DM Sans", "Noto Sans KR", sans-serif'
    ctx.fillStyle = '#6B7280'
    ctx.fillText(locale === 'en' ? 'score' : '점수', cx, cy + 58)
    ctx.textAlign = 'left'

    ctx.fillStyle = '#1A1F2C'
    ctx.font = '600 34px "Noto Sans KR", "DM Sans", sans-serif'
    const scoreLabel =
      locale === 'en' ? 'Nutrition score from your recent meals' : '최근 식사 기준 영양 점수'
    const scoreLines = wrapByWidth(ctx, scoreLabel, contentW - 220, 2)
    let sy = cy - 20
    for (const line of scoreLines) {
      ctx.fillText(line, padX + 210, sy)
      sy += 44
    }
    y = cy + 130
  }

  // Headline
  ctx.fillStyle = '#1A1F2C'
  ctx.font = '700 52px "Noto Sans KR", Outfit, sans-serif'
  const headLines = wrapByWidth(ctx, headline, contentW, 4)
  for (const line of headLines) {
    ctx.fillText(line, padX, y)
    y += 68
  }
  y += 28

  // Divider
  ctx.strokeStyle = 'rgba(34, 160, 107, 0.25)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(padX, y)
  ctx.lineTo(padX + contentW, y)
  ctx.stroke()
  y += 56

  // Subtitle
  if (subtitle) {
    ctx.fillStyle = '#374151'
    ctx.font = '500 36px "Noto Sans KR", "DM Sans", sans-serif'
    const subLines = wrapByWidth(ctx, subtitle, contentW, 4)
    for (const line of subLines) {
      ctx.fillText(line, padX, y)
      y += 52
    }
  }

  // Footer
  ctx.fillStyle = '#22A06B'
  ctx.font = '600 30px Outfit, "Noto Sans KR", sans-serif'
  ctx.fillText(
    locale === 'en' ? 'Keep going — one meal at a time' : '한 끼씩, 꾸준히 가면 됩니다',
    padX,
    H - 80,
  )

  return canvas.toDataURL('image/png')
}
