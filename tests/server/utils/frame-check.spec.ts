import { describe, expect, it } from 'vitest'
import { frameAllowed, isPrivateHost } from '../../../server/utils/frame-check'

const ORIGIN = 'https://app.elev8-suite.com'

describe('frameAllowed', () => {
  it('allows a site with no framing headers', () => {
    expect(frameAllowed({}, ORIGIN)).toBe(true)
  })

  it('refuses X-Frame-Options DENY and SAMEORIGIN', () => {
    expect(frameAllowed({ xFrameOptions: 'SAMEORIGIN' }, ORIGIN)).toBe(false)
    expect(frameAllowed({ xFrameOptions: 'deny' }, ORIGIN)).toBe(false)
  })

  it('reads CSP frame-ancestors, which wins over X-Frame-Options', () => {
    expect(frameAllowed({ csp: 'default-src \'self\'; frame-ancestors \'none\'' }, ORIGIN)).toBe(false)
    expect(frameAllowed({ csp: 'frame-ancestors \'self\'' }, ORIGIN)).toBe(false)
    expect(frameAllowed({ csp: 'frame-ancestors *', xFrameOptions: 'DENY' }, ORIGIN)).toBe(true)
    expect(frameAllowed({ csp: 'frame-ancestors https:' }, ORIGIN)).toBe(true)
    expect(frameAllowed({ csp: 'frame-ancestors https://*.elev8-suite.com' }, ORIGIN)).toBe(true)
    expect(frameAllowed({ csp: 'frame-ancestors https://other.com' }, ORIGIN)).toBe(false)
  })

  it('ignores a CSP without frame-ancestors', () => {
    expect(frameAllowed({ csp: 'default-src \'self\'' }, ORIGIN)).toBe(true)
    expect(frameAllowed({ csp: 'default-src \'self\'', xFrameOptions: 'SAMEORIGIN' }, ORIGIN)).toBe(false)
  })
})

describe('isPrivateHost', () => {
  it('flags the server\'s own network and lets public hosts through', () => {
    for (const h of ['localhost', '127.0.0.1', '10.0.0.5', '192.168.1.1', '172.20.0.1', '169.254.169.254', '[::1]'])
      expect(isPrivateHost(h)).toBe(true)
    for (const h of ['docs.google.com', 'fcbarcelona.com', '172.32.0.1', 'example.com'])
      expect(isPrivateHost(h)).toBe(false)
  })
})
