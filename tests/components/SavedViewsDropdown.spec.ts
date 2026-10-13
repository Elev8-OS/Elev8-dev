import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SavedViewsDropdown from '~/components/listings/SavedViewsDropdown.vue'

const passthrough = { template: '<div><slot /></div>' }

// The menu content is portalled and closed by default: render it inline so the rows exist.
const stubs = {
  DropdownMenu: passthrough,
  DropdownMenuTrigger: passthrough,
  DropdownMenuContent: passthrough,
  DropdownMenuItem: passthrough,
  DropdownMenuSeparator: { template: '<hr>' },
  ScrollArea: passthrough,
  DeleteViewDialog: true,
  UnsavedChangesDialog: true,
}

const baseProps = {
  savedViews: [],
  activeView: null,
  isDirty: false,
  isLoading: false,
  canUpdateActiveView: false,
}

function mountDropdown(props: Record<string, unknown> = {}) {
  return mount(SavedViewsDropdown, { props: { ...baseProps, ...props }, global: { stubs } })
}

const teamView = { id: 'team', name: 'Canggu pool villas', visibility: 'public', createdBy: 'user-2', createdByName: 'Made Surya' }
const minePublic = { id: 'mine-pub', name: 'Arrivals', visibility: 'public', createdBy: 'user-1', createdByName: 'Komang Juliantara' }
const minePersonal = { id: 'mine-per', name: 'My pool list', visibility: 'personal', createdBy: 'user-1', createdByName: 'Komang Juliantara' }
const defaultView = { id: 'default', name: 'Default View', isDefault: true }

describe('savedViewsDropdown', () => {
  it('renders the active view name', () => {
    const wrapper = mountDropdown({ activeView: { id: '1', name: 'My View' } })
    expect(wrapper.text()).toContain('Saved Views: My View')
  })

  it('offers "Save view as" even with no views', async () => {
    const wrapper = mountDropdown()
    await wrapper.find('[data-testid="save-as-option"]').trigger('click')
    expect(wrapper.find('[data-testid="save-form"]').exists()).toBe(true)
  })

  it('emits load-view when a view is clicked', async () => {
    const wrapper = mountDropdown({ savedViews: [{ id: '1', name: 'My View' }] })
    await wrapper.find('[data-testid="view-item-1"]').trigger('click')
    expect(wrapper.emitted('loadView')?.[0]).toEqual(['1'])
  })

  describe('without currentUserId (Analytics, Review Hub)', () => {
    it('shows no visibility choice and saves with the personal default', async () => {
      const wrapper = mountDropdown()
      await wrapper.find('[data-testid="save-as-option"]').trigger('click')
      expect(wrapper.find('[data-testid="visibility-public"]').exists()).toBe(false)
      await wrapper.find('[data-testid="save-confirm"]').trigger('click')
      expect(wrapper.emitted('saveAs')?.[0]).toEqual(['New View 1', 'personal'])
    })

    it('keeps a flat list with edit actions on every custom view', () => {
      const wrapper = mountDropdown({ savedViews: [defaultView, teamView] })
      expect(wrapper.find('[data-testid="section-team"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="view-item-team"] [aria-label="Delete view"]').exists()).toBe(true)
    })
  })

  describe('with currentUserId (Listings)', () => {
    const props = { currentUserId: 'user-1', savedViews: [defaultView, minePersonal, minePublic, teamView] }

    it('groups views into My views and Shared by team', () => {
      const wrapper = mountDropdown(props)
      const mine = wrapper.find('[data-testid="section-mine"]')
      const team = wrapper.find('[data-testid="section-team"]')
      expect(mine.text()).toBe('My views')
      expect(team.text()).toBe('Shared by team')
      expect(wrapper.find('[data-testid="view-item-team"]').text()).toContain('by Made Surya')
    })

    it('saves a public view when Public is chosen', async () => {
      const wrapper = mountDropdown(props)
      await wrapper.find('[data-testid="save-as-option"]').trigger('click')
      expect(wrapper.text()).toContain('Only you can see it.')
      await wrapper.find('[data-testid="visibility-public"]').trigger('click')
      expect(wrapper.text()).toContain('Everyone on your team can use it.')
      await wrapper.find('[data-testid="save-confirm"]').trigger('click')
      expect(wrapper.emitted('saveAs')?.[0]).toEqual(['New View 1', 'public'])
    })

    it('hides rename, delete and share on a teammate view', () => {
      const wrapper = mountDropdown(props)
      const row = wrapper.find('[data-testid="view-item-team"]')
      expect(row.find('[aria-label="Delete view"]').exists()).toBe(false)
      expect(row.find('[aria-label="Rename view"]').exists()).toBe(false)
      expect(row.find('[data-testid="toggle-visibility-team"]').exists()).toBe(false)
    })

    it('toggles visibility on own views', async () => {
      const wrapper = mountDropdown(props)
      await wrapper.find('[data-testid="toggle-visibility-mine-per"]').trigger('click')
      await wrapper.find('[data-testid="toggle-visibility-mine-pub"]').trigger('click')
      expect(wrapper.emitted('setVisibility')).toEqual([['mine-per', 'public'], ['mine-pub', 'personal']])
      expect(wrapper.emitted('loadView')).toBeUndefined()
    })
  })
})
