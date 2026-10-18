import type { Listing } from '~/components/listings/data/listings'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { toRaw } from 'vue'
import { deleteTag, renameTag, tagCreateError, tagRenameError, tagUsage } from '~/components/listings/data/listing-tags'
import { listings } from '~/components/listings/data/listings'

let snapshot: Listing[]
beforeEach(() => { snapshot = JSON.parse(JSON.stringify(toRaw(listings.value))) })
afterEach(() => { listings.value = snapshot })

describe('manage tags', () => {
  it('renames a tag on every listing that has it', () => {
    const n = tagUsage('Canggu')
    expect(n).toBeGreaterThan(1)
    expect(renameTag('Canggu', 'Canggu Beach')).toBe(n)
    expect(tagUsage('Canggu')).toBe(0)
    expect(tagUsage('Canggu Beach')).toBe(n)
  })

  it('refuses an empty, long or taken name, in any case', () => {
    expect(tagRenameError('Canggu', '  ')).toBeTruthy()
    expect(tagRenameError('Canggu', 'x'.repeat(31))).toBeTruthy()
    expect(tagRenameError('Canggu', 'pool')).toBeTruthy()
    expect(tagRenameError('Canggu', 'canggu')).toBeNull()
    expect(renameTag('Canggu', 'pool')).toBe(0)
    expect(tagUsage('Canggu')).toBeGreaterThan(0)
  })

  it('deletes a tag from every listing', () => {
    const n = tagUsage('Pool')
    expect(deleteTag('Pool')).toBe(n)
    expect(tagUsage('Pool')).toBe(0)
    expect(listings.value.every(l => !l.tags.includes('Pool'))).toBe(true)
  })

  it('refuses a new tag that is empty, long or already exists in any case', () => {
    expect(tagCreateError(' ')).toBeTruthy()
    expect(tagCreateError('x'.repeat(31))).toBeTruthy()
    expect(tagCreateError('POOL')).toBeTruthy()
    expect(tagCreateError('Brand new tag')).toBeNull()
  })
})
