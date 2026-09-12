// The palette and hash used to be copy-pasted into the reservations guest cell,
// the users table and the owners table. Three surfaces now import it, so the
// property that matters is that one person always gets one colour: a change here
// silently repaints avatars across the app.

import { describe, expect, it } from 'vitest'
import { AVATAR_COLORS, avatarColorFor, initials } from '~/lib/avatar-colors'

describe('initials', () => {
  it('takes the first letter of the first two words, upper-cased', () => {
    expect(initials('Emily Chen')).toBe('EC')
    expect(initials('reto wyss')).toBe('RW')
  })

  it('stops at two even for a longer name', () => {
    expect(initials('Maria Isabel Santos Cruz')).toBe('MI')
  })

  it('handles a single word', () => {
    expect(initials('Komang')).toBe('K')
  })

  it('survives the ragged input real guest lists contain', () => {
    // Double spaces used to yield an undefined that join() swallowed. Pinning
    // it so a future rewrite cannot start emitting "undefined" into the DOM.
    expect(initials('Emily  Chen')).toBe('EC')
    expect(initials(' Emily Chen ')).toBe('EC')
    expect(initials('')).toBe('')
  })
})

describe('avatarColorFor', () => {
  it('gives the same name the same colour every time', () => {
    expect(avatarColorFor('Emily Chen')).toBe(avatarColorFor('Emily Chen'))
  })

  it('always returns a class from the palette, never undefined', () => {
    const names = ['Emily Chen', 'Marcus Johnson', 'Alex Rivera', 'Nathan Hale', 'Komang Juliantara', '']

    for (const name of names)
      expect(AVATAR_COLORS).toContain(avatarColorFor(name))
  })

  it('spreads a realistic guest list across more than one colour', () => {
    const names = ['Emily Chen', 'Marcus Johnson', 'Alex Rivera', 'Nathan Hale', 'Anna Schmidt', 'Yuki Tanaka']
    const used = new Set(names.map(avatarColorFor))

    expect(used.size).toBeGreaterThan(1)
  })

  it('reads the whole string, so a longer name is not merely its first letters', () => {
    // Not a uniqueness guarantee: with 8 buckets two names collide often, and
    // that is fine. This only pins that the hash consumes more than a prefix.
    const colours = new Set(['A', 'AB', 'ABC', 'ABCD', 'ABCDE', 'ABCDEF'].map(avatarColorFor))

    expect(colours.size).toBeGreaterThan(1)
  })
})
