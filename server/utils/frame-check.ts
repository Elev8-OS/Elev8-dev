/**
 * Whether a site lets the dashboard show it in a frame (listing custom tabs).
 * A cross-origin frame cannot tell the page it was refused, so the server
 * reads the site's response headers instead. Framework-free so it can be
 * tested without h3.
 */

/**
 * Reads `X-Frame-Options` and CSP `frame-ancestors` against the dashboard's
 * origin. CSP wins when it names `frame-ancestors`, as in browsers.
 */
export function frameAllowed(
  headers: { xFrameOptions?: string | null, csp?: string | null },
  dashboardOrigin: string,
): boolean {
  const ancestors = (headers.csp ?? '')
    .split(/[;,]/)
    .map(d => d.trim().split(/\s+/))
    .find(([name]) => name?.toLowerCase() === 'frame-ancestors')
  if (ancestors)
    return ancestors.slice(1).some(source => sourceMatches(source, dashboardOrigin))

  const xfo = headers.xFrameOptions?.trim().toLowerCase()
  if (!xfo)
    return true
  // DENY, SAMEORIGIN (the site is never the dashboard's origin) and the obsolete ALLOW-FROM all refuse.
  return false
}

function sourceMatches(source: string, origin: string): boolean {
  const s = source.replace(/^'|'$/g, '').toLowerCase()
  if (s === 'none' || s === 'self')
    return false
  if (s === '*')
    return true
  const url = new URL(origin)
  if (s === url.protocol)
    return true
  const [, scheme, host] = /^(?:([a-z][a-z\d+.-]*):\/\/)?([^/]+)/.exec(s) ?? []
  if (!host || (scheme && `${scheme}:` !== url.protocol))
    return false
  if (host.startsWith('*.'))
    return url.host.endsWith(host.slice(1))
  return host === url.host || host === url.hostname
}

/** Hosts the check never fetches: the server's own network. */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return h === 'localhost'
    || h.endsWith('.localhost')
    || h.endsWith('.internal')
    || h === '::1'
    || (h.includes(':') && /^(?:fc|fd|fe80)/.test(h))
    || /^(?:0|10|127)\./.test(h)
    || /^169\.254\./.test(h)
    || /^192\.168\./.test(h)
    || /^172\.(?:1[6-9]|2\d|3[01])\./.test(h)
}
