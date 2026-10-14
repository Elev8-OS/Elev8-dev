import { frameAllowed, isPrivateHost } from '../utils/frame-check'

/**
 * Whether a custom tab's site can be shown in a frame on the listing page.
 *
 * GET /api/frame-check?url=https://docs.google.com/...
 *
 * -> { embeddable: true | false | null }   null = could not tell (site down, timeout)
 */
export default defineEventHandler(async (event) => {
  const { url: raw } = getQuery(event)
  let url: URL
  try {
    url = new URL(String(raw ?? ''))
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid url' })
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || isPrivateHost(url.hostname))
    throw createError({ statusCode: 400, statusMessage: 'Invalid url' })

  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(5000) })
    await res.body?.cancel()
    return {
      embeddable: frameAllowed(
        { xFrameOptions: res.headers.get('x-frame-options'), csp: res.headers.get('content-security-policy') },
        getRequestURL(event).origin,
      ),
    }
  }
  catch {
    return { embeddable: null }
  }
})
