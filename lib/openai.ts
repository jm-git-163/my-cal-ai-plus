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

export function getImageModel() {
  return process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'
}
