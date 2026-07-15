import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getImageModel, getOpenAI } from '../lib/openai'

/**
 * Healthy share card via Images API (OpenAI docs Image generation).
 * Falls back gracefully if the model is unavailable on the account.
 * @see https://developers.openai.com/api/docs/guides/images-vision
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { headline, subtitle, locale } = req.body as {
      headline?: string
      subtitle?: string
      locale?: string
    }

    const title = (headline || 'My Cal AI Plus').slice(0, 80)
    const sub = (subtitle || 'Snap · Analyze · Coach · Improve').slice(0, 120)
    const lang = locale === 'en' ? 'English' : 'Korean'

    const client = getOpenAI()
    const model = getImageModel()

    const prompt = `Create a clean vertical healthy lifestyle share card graphic (9:16).
Brand: My Cal AI Plus. Style: soft green accents, white space, modern wellness aesthetic, no logos of other brands, no small illegible text.
Large readable title in ${lang}: "${title}"
Small supporting line: "${sub}"
Include subtle leaf / fresh food motifs. No photorealistic people faces.`

    const result = await client.images.generate({
      model,
      prompt,
      size: '1024x1024',
    })

    const b64 = result.data?.[0]?.b64_json
    if (!b64) {
      return res.status(502).json({ error: 'No image returned from OpenAI' })
    }

    return res.status(200).json({
      image: `data:image/png;base64,${b64}`,
      model,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Image generation failed'
    console.error('[api/image]', message)
    return res.status(500).json({ error: message })
  }
}
