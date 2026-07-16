import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Share cards are rendered on-device (canvas) so text stays exact.
 * This endpoint is kept only for backward compatibility / old clients.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  return res.status(410).json({
    error:
      'Share cards are generated on the device now for accurate text. Update the app / refresh the page.',
    code: 'SHARE_CARD_CLIENT_SIDE',
  })
}
