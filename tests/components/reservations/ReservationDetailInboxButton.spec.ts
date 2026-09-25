import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'

// The detail sheet is too heavy to mount here (the other sheet specs read its
// source the same way); the behaviour behind the button is covered by
// `openForReservation` in useInbox-reservation-conversation.spec.ts.
describe('reservation detail inbox button', () => {
  const source = readFileSync(join(process.cwd(), 'app/components/reservations/ReservationDetailSheet.vue'), 'utf8')

  it('sits in the header beside Edit reservation', () => {
    const header = source.slice(source.indexOf('Header: status dropdown'), source.indexOf('<ScrollArea'))
    expect(header).toContain('data-testid="reservation-open-inbox"')
    expect(header).toContain('Edit reservation')
  })

  it('opens the conversation through openForReservation, closes the sheet and goes to the inbox', () => {
    expect(source).toContain('inbox.openForReservation(props.reservation)')
    expect(source).toContain('emit(\'update:open\', false)')
    expect(source).toContain('navigateTo(\'/inbox\')')
  })

  it('is disabled only when there is no conversation and no email address', () => {
    expect(source).toContain(':disabled="!canOpenInbox"')
    expect(source).toContain('hasConversation.value || Boolean(props.reservation?.guestEmail?.trim())')
  })
})
