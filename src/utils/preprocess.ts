/**
 * CNN-inspired client-side preprocess before GPT Vision.
 * Resize first (docs: control GPT-5.6 token/latency vs detail=original),
 * then contrast → Sobel-like edge blend → mild denoise.
 */

export interface PreprocessOptions {
  maxSize?: number
  contrast?: number
  edgeStrength?: number
}

function clamp(v: number) {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

function applyContrast(data: Uint8ClampedArray, factor: number) {
  const intercept = 128 * (1 - factor)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(data[i] * factor + intercept)
    data[i + 1] = clamp(data[i + 1] * factor + intercept)
    data[i + 2] = clamp(data[i + 2] * factor + intercept)
  }
}

/** 3×3 Sobel-style edge magnitude, blended back into RGB */
function enhanceEdges(data: Uint8ClampedArray, width: number, height: number, strength: number) {
  const copy = new Uint8ClampedArray(data)
  const gxK = [-1, 0, 1, -2, 0, 2, -1, 0, 1]
  const gyK = [-1, -2, -1, 0, 0, 0, 1, 2, 1]

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0
      let gy = 0
      let ki = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4
          const gray = 0.299 * copy[idx] + 0.587 * copy[idx + 1] + 0.114 * copy[idx + 2]
          gx += gray * gxK[ki]
          gy += gray * gyK[ki]
          ki++
        }
      }
      const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy))
      const i = (y * width + x) * 4
      data[i] = clamp(copy[i] * (1 - strength) + mag * strength)
      data[i + 1] = clamp(copy[i + 1] * (1 - strength) + mag * strength)
      data[i + 2] = clamp(copy[i + 2] * (1 - strength) + mag * strength)
    }
  }
}

/** 3×3 box blur for mild noise reduction (pooling-like smoothing) */
function reduceNoise(data: Uint8ClampedArray, width: number, height: number) {
  const copy = new Uint8ClampedArray(data)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            sum += copy[((y + ky) * width + (x + kx)) * 4 + c]
          }
        }
        data[(y * width + x) * 4 + c] = Math.round(sum / 9)
      }
    }
  }
}

export async function preprocessImage(
  fileOrDataUrl: File | string,
  options: PreprocessOptions = {},
): Promise<string> {
  const { maxSize = 1536, contrast = 1.15, edgeStrength = 0.18 } = options

  const src =
    typeof fileOrDataUrl === 'string'
      ? fileOrDataUrl
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('Failed to read file'))
          reader.readAsDataURL(fileOrDataUrl)
        })

  const img = await loadImage(src)
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas not supported')

  ctx.drawImage(img, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)

  applyContrast(imageData.data, contrast)
  enhanceEdges(imageData.data, width, height, edgeStrength)
  reduceNoise(imageData.data, width, height)

  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.88)
}

export async function resizeForVision(
  fileOrDataUrl: File | string,
  maxSize = 1536,
): Promise<string> {
  const src =
    typeof fileOrDataUrl === 'string'
      ? fileOrDataUrl
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('Failed to read file'))
          reader.readAsDataURL(fileOrDataUrl)
        })

  const img = await loadImage(src)
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', 0.9)
}

export function guessMealType(date = new Date()): import('@/types').MealType {
  const hour = date.getHours()
  if (hour < 11) return 'Breakfast'
  if (hour < 15) return 'Lunch'
  if (hour < 20) return 'Dinner'
  return 'Snack'
}
