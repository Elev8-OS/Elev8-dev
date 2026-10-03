import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { listings } from '~/components/listings/data/listings'
import ListingAssignedUsers from '~/components/listings/ListingAssignedUsers.vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { useUsers } from '~/composables/useUsers'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  // The popover renders inline so the test can read the list without opening it.
  Popover: passthrough,
  PopoverTrigger: passthrough,
  PopoverContent: passthrough,
  Avatar: passthrough,
  AvatarFallback: passthrough,
}
const COMPONENTS = { Button, Input }

function mountFor(listingId = 'lst-1') {
  const listing = listings.value.find(l => l.id === listingId)!
  return mount(ListingAssignedUsers, { props: { listing }, global: { components: COMPONENTS, stubs: STUBS } })
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('listingAssignedUsers', () => {
  it('counts the users assigned to the listing', () => {
    const count = useUsers().getUsersForListing('lst-1').length
    expect(count).toBeGreaterThan(0)
    expect(mountFor().get('[data-testid="assigned-users-count"]').text()).toBe(`${count} ${count === 1 ? 'user' : 'users'}`)
  })

  it('lists assigned users first, checked', () => {
    const count = useUsers().getUsersForListing('lst-1').length
    const rows = mountFor().findAll('[data-testid="assigned-users-option"]')
    expect(rows.slice(0, count).every(r => r.attributes('data-assigned') !== undefined)).toBe(true)
    expect(rows.slice(count).every(r => r.attributes('data-assigned') === undefined)).toBe(true)
  })

  it('assigns and unassigns a user on the Users store', async () => {
    const { users, getUsersForListing } = useUsers()
    const outsider = users.value.find(u => !u.listingIds.includes('lst-1'))!
    const before = getUsersForListing('lst-1').length
    const wrapper = mountFor()
    const row = () => wrapper.findAll('[data-testid="assigned-users-option"]').find(r => r.text().includes(outsider.name))!

    await row().trigger('click')
    await nextTick()
    expect(getUsersForListing('lst-1').map(u => u.id)).toContain(outsider.id)
    expect(wrapper.get('[data-testid="assigned-users-count"]').text()).toContain(String(before + 1))
    expect(toast.success).toHaveBeenLastCalledWith(expect.stringContaining('assigned to'))

    await row().trigger('click')
    await nextTick()
    expect(getUsersForListing('lst-1').map(u => u.id)).not.toContain(outsider.id)
    expect(toast.success).toHaveBeenLastCalledWith(`${outsider.name} unassigned`)
  })

  it('offers to assign when nobody is assigned', () => {
    const { users } = useUsers()
    const empty = listings.value.find(l => !users.value.some(u => u.listingIds.includes(l.id)))!
    expect(mountFor(empty.id).get('[data-testid="assigned-users-count"]').text()).toBe('Assign users')
  })
})
