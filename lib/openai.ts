import OpenAI from 'openai'

export function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return new OpenAI({ apiKey })
}

/** Vision / heavy tasks — Prefer OPENAI_MODEL; defaults to gpt-5.6. */
export function getModel() {
  return process.env.OPENAI_MODEL || 'gpt-5.6'
}

/**
 * Coach / “지금 뭐먹지” — speed over frontier quality.
 * Default gpt-4.1-mini (does NOT fall back to OPENAI_MODEL, which is often slow).
 */
export function getFastModel() {
  return process.env.OPENAI_FAST_MODEL || 'gpt-4.1-mini'
}

/** Reasoning effort only applies to GPT-5 / o-series models. */
export function supportsReasoningEffort(model: string): boolean {
  return /^(gpt-5|o\d|o-mini)/i.test(model)
}

export function getFastReasoningEffort(): 'minimal' | 'low' | 'medium' | 'high' {
  // Default minimal — coach/recommend stay structured; extra reasoning mostly adds latency.
  const raw = (process.env.OPENAI_FAST_REASONING || 'minimal').toLowerCase()
  if (raw === 'none' || raw === 'minimal') return 'minimal'
  if (raw === 'low' || raw === 'medium' || raw === 'high') return raw
  return 'minimal'
}

export function getImageModel() {
  return process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'
}
