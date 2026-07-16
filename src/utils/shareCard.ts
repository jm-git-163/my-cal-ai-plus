/** Client-side share card — exact text, premium wellness layout. */

export interface ShareCardInput {
  headline: string
  subtitle: string
  score?: number
  locale?: 'ko' | 'en'
}

const W = 1080
const H = 1920 // 9:16 — story / share friendly

/** Truncate on grapheme boundaries; prefer sentence / word ends. */
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
    document.fonts.load('700 80px Outfit'),
    document.fonts.load('600 56px Outfit'),
    document.fonts.load('700 52px "Noto Sans KR"'),
    document.fonts.load('500 34px "Noto Sans KR"'),
    document.fonts.load('600 28px "DM Sans"'),
  ]).catch(() => undefined)
  await document.fonts.ready.catch(() => undefined)
}

function drawLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  rot: number,
  alpha: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.scale(scale, scale)
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#22A06B'
  ctx.beginPath()
  ctx.moveTo(0, -60)
  ctx.bezierCurveTo(38, -40, 48, 10, 0, 70)
  ctx.bezierCurveTo(-48, 10, -38, -40, 0, -60)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, -48)
  ctx.quadraticCurveTo(4, 10, 0, 55)
  ctx.stroke()
  ctx.restore()
}

function drawScoreRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  score: number,
) {
  const track = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
  track.addColorStop(0, 'rgba(34, 160, 107, 0.12)')
  track.addColorStop(1, 'rgba(232, 139, 46, 0.1)')
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = track
  ctx.lineWidth = 22
  ctx.lineCap = 'round'
  ctx.stroke()

  const pct = Math.max(0, Math.min(1, score / 100))
  const start = -Math.PI / 2
  const end = start + pct * Math.PI * 2
  const arc = ctx.createLinearGradient(cx - r, cy, cx + r, cy)
  arc.addColorStop(0, '#22A06B')
  arc.addColorStop(1, '#3DCF8A')
  ctx.beginPath()
  ctx.arc(cx, cy, r, start, end)
  ctx.strokeStyle = arc
  ctx.lineWidth = 22
  ctx.stroke()

  // soft inner disc
  ctx.beginPath()
  ctx.arc(cx, cy, r - 48, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
  ctx.fill()
}

/**
 * Renders a branded share card as a PNG data URL.
 * Full-bleed wellness layout — text stays exact (canvas fonts).
 */
export async function renderShareCard(input: ShareCardInput): Promise<string> {
  await ensureFonts()

  const locale = input.locale === 'en' ? 'en' : 'ko'
  const headline = clipShareText(input.headline || 'My Cal AI Plus', 56)
  const subtitle = clipShareText(input.subtitle || '', 90)
  const score =
    typeof input.score === 'number' && Number.isFinite(input.score)
      ? Math.min(100, Math.max(0, Math.round(input.score)))
      : null

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  // ——— Atmosphere (full bleed, no nested “form card”) ———
  const bg = ctx.createLinearGradient(0, 0, W * 0.2, H)
  bg.addColorStop(0, '#D8F3E4')
  bg.addColorStop(0.35, '#EEF9F2')
  bg.addColorStop(0.7, '#FFF8F0')
  bg.addColorStop(1, '#F3EDE4')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // soft light orbs
  const orb = (x: number, y: number, rx: number, ry: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry))
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  orb(180, 220, 340, 280, 'rgba(34, 160, 107, 0.28)')
  orb(920, 380, 300, 260, 'rgba(232, 139, 46, 0.2)')
  orb(540, 1680, 420, 320, 'rgba(47, 111, 237, 0.12)')

  drawLeaf(ctx, 880, 160, 1.15, 0.45, 0.14)
  drawLeaf(ctx, 160, 1720, 1.4, -0.7, 0.12)
  drawLeaf(ctx, 960, 1500, 0.85, 2.2, 0.1)

  const padX = 96
  const contentW = W - padX * 2
  let y = 140

  // Brand mark
  ctx.fillStyle = 'rgba(34, 160, 107, 0.14)'
  roundPill(ctx, padX, y - 28, 280, 56)
  ctx.fill()
  ctx.fillStyle = '#1A7A52'
  ctx.font = '700 28px Outfit, "Noto Sans KR", sans-serif'
  ctx.fillText('My Cal AI Plus', padX + 28, y + 8)
  y += 100

  ctx.fillStyle = 'rgba(26, 31, 44, 0.45)'
  ctx.font = '500 26px "DM Sans", "Noto Sans KR", sans-serif'
  ctx.fillText(
    locale === 'en' ? 'Snap · Analyze · Coach · Improve' : '스냅 · 분석 · 코치 · 성장',
    padX,
    y,
  )
  y += 80

  // Hero score — ring + “n / 100” so scale is obvious
  if (score !== null) {
    const cx = W / 2
    const cy = y + 210
    drawScoreRing(ctx, cx, cy, 168, score)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#1A1F2C'
    ctx.font = '700 110px Outfit, sans-serif'
    ctx.fillText(String(score), cx, cy + 28)
    ctx.fillStyle = '#6B7280'
    ctx.font = '600 36px Outfit, "Noto Sans KR", sans-serif'
    ctx.fillText('/ 100', cx, cy + 78)
    ctx.fillStyle = '#22A06B'
    ctx.font = '600 28px "Noto Sans KR", "DM Sans", sans-serif'
    ctx.fillText(
      locale === 'en' ? `Nutrition score · ${score} of 100` : `영양 점수 · 100점 만점 중 ${score}점`,
      cx,
      cy + 128,
    )
    ctx.textAlign = 'left'
    y = cy + 260
  } else {
    y += 40
  }

  // Headline block — airy, centered feel but left-aligned for Korean readability
  ctx.fillStyle = '#1A1F2C'
  ctx.font = '700 54px "Noto Sans KR", Outfit, sans-serif'
  const headLines = wrapByWidth(ctx, headline, contentW, 3)
  for (const line of headLines) {
    ctx.fillText(line, padX, y)
    y += 72
  }
  y += 36

  // Accent rule
  const ruleGrad = ctx.createLinearGradient(padX, 0, padX + 160, 0)
  ruleGrad.addColorStop(0, '#22A06B')
  ruleGrad.addColorStop(1, 'rgba(34, 160, 107, 0)')
  ctx.fillStyle = ruleGrad
  ctx.fillRect(padX, y, 160, 5)
  y += 56

  // Subtitle
  if (subtitle) {
    ctx.fillStyle = 'rgba(26, 31, 44, 0.72)'
    ctx.font = '500 34px "Noto Sans KR", "DM Sans", sans-serif'
    const subLines = wrapByWidth(ctx, subtitle, contentW, 4)
    for (const line of subLines) {
      ctx.fillText(line, padX, y)
      y += 50
    }
  }

  // Bottom glass strip
  const footY = H - 220
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  roundRect(ctx, 64, footY, W - 128, 140, 36)
  ctx.fill()
  ctx.strokeStyle = 'rgba(34, 160, 107, 0.18)'
  ctx.lineWidth = 2
  roundRect(ctx, 64, footY, W - 128, 140, 36)
  ctx.stroke()

  ctx.fillStyle = '#1A7A52'
  ctx.font = '600 32px "Noto Sans KR", Outfit, sans-serif'
  ctx.fillText(
    locale === 'en' ? 'Keep going — one meal at a time' : '한 끼씩, 꾸준히 가면 됩니다',
    108,
    footY + 62,
  )
  ctx.fillStyle = 'rgba(26, 31, 44, 0.45)'
  ctx.font = '500 24px "DM Sans", "Noto Sans KR", sans-serif'
  ctx.fillText(locale === 'en' ? 'calaicnn.vercel.app' : 'calaicnn.vercel.app', 108, footY + 104)

  return canvas.toDataURL('image/png')
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

function roundPill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  roundRect(ctx, x, y, w, h, h / 2)
}
