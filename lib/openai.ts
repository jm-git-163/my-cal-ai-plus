import OpenAI from 'openai'

export function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return new OpenAI({ apiKey })
}

/** Prefer OPENAI_MODEL; defaults to gpt-5.6 per OpenAI platform docs. */
export function getModel() {
  return process.env.OPENAI_MODEL || 'gpt-5.6'
}

/**
 * Fast path for coach / “지금 뭐먹지” — shorter latency than full vision model.
 * Override with OPENAI_FAST_MODEL; falls back to OPENAI_MODEL / gpt-5.6.
 */
export function getFastModel() {
  return process.env.OPENAI_FAST_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6'
}

/** Reasoning effort for structured JSON coaching (low = much faster). */
export function getFastReasoningEffort(): 'minimal' | 'low' | 'medium' | 'high' {
  const raw = (process.env.OPENAI_FAST_REASONING || 'low').toLowerCase()
  if (raw === 'none' || raw === 'minimal') return 'minimal'
  if (raw === 'medium' || raw === 'high') return raw
  return 'low'
}

export function getImageModel() {
  return process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'
}
