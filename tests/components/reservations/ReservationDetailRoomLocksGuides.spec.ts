import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'

// The detail sheet is too heavy to mount here, so read its source like the
// invoice button spec does.
describe('reservation detail rooms: smart lock and guest guide', () => {
  const source = readFileSync(join(process.cwd(), 'app/components/reservations/ReservationDetailSheet.vue'), 'utf8')

  it('shows each room\'s lock and guide link on its card', () => {
    const rooms = source.slice(source.indexOf('<!-- Rooms (multi-room booking) -->'), source.indexOf('<!-- Extensions'))
    expect(rooms).toContain('data-testid="room-lock"')
    expect(rooms).toContain('roomLockLabel(room.unitId)')
    expect(rooms).toContain('data-testid="room-guide-link"')
    expect(rooms).toContain('roomGuideRoute(room.unitId)')
  })

  it('groups the Smart lock section by room, with property-level locks apart', () => {
    expect(source).toContain('smartLock.getLocksForUnit(r.listingId, room.unitId)')
    expect(source).toContain('title: \'Property\'')
    expect(source).toContain('v-for="group in lockGroups"')
    expect(source).toContain('No lock paired to this room.')
  })

  it('keeps a single-room stay as one untitled group of the listing locks', () => {
    expect(source).toContain('[{ key: \'listing\', title: \'\', locks: locksForListing(r.listingId) }]')
  })

  it('opens a per-room menu from View guest guide only when there are several rooms', () => {
    expect(source).toContain('v-if="(reservation.rooms?.length ?? 0) > 1"')
    expect(source).toContain('data-testid="view-guest-guide-menu"')
    expect(source).toContain('<DropdownMenuLabel>Guest guide per room</DropdownMenuLabel>')
    expect(source).toContain('<Button v-else variant="outline" size="sm" class="w-full gap-1.5" as-child>')
  })
})
