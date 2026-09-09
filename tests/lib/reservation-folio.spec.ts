import { describe, expect, it } from 'vitest'
import {
  folioLineNet,
  folioLineService,
  folioLineTax,
  folioLineTotal,
} from '~/components/reservations/data/folio'

/** A priceable line. Only the four pricing fields are needed. */
function line(over: Partial<{ quantity: number, unitPrice: number, taxPercent: number, servicePercent: number }> = {}) {
  return { quantity: 1, unitPrice: 0, taxPercent: 0, servicePercent: 0, ...over }
}

describe('folio line arithmetic', () => {
  it('multiplies quantity by unit price for the net', () => {
    expect(folioLineNet(line({ quantity: 2, unitPrice: 6 }))).toBe(12)
  })

  it('applies tax and service to the net in parallel, never compounded', () => {
    const item = line({ quantity: 1, unitPrice: 100, taxPercent: 11, servicePercent: 5 })

    expect(folioLineTax(item)).toBe(11)
    expect(folioLineService(item)).toBe(5)
    // Compounding would make this 116.55 instead of 116.
    expect(folioLineTotal(item)).toBe(116)
  })

  it('rounds to the currency minor unit, not the whole unit', () => {
    // A CHF 6.00 beer at 10 percent owes 0.60, not 1.
    expect(folioLineTax(line({ quantity: 1, unitPrice: 6, taxPercent: 10 }))).toBe(0.6)
    expect(folioLineTotal(line({ quantity: 1, unitPrice: 6, taxPercent: 10 }))).toBe(6.6)
  })

  it('prices a whole-unit currency line without stray decimals', () => {
    const item = line({ quantity: 1, unitPrice: 350000, taxPercent: 11, servicePercent: 5 })

    expect(folioLineTotal(item)).toBe(406000)
  })

  it('treats a zero-percent line as its net', () => {
    expect(folioLineTotal(line({ quantity: 3, unitPrice: 4 }))).toBe(12)
  })
})
