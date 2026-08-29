import type { PhoneCall, PhoneCallStatus, UnmatchedCall } from '~/components/inbox/data/conversations'
import { resolveConversationTenantId } from '~/components/inbox/data/conversations'
import { endOfDay, startOfDay, subDays } from 'date-fns'
import { computed } from 'vue'
import { useGroScope } from './useGroScope'

export type CallsDateRange = 'today' | 'last-7-days' | 'last-30-days' | 'all'

export function useCallsFilters() {
  const searchQuery = useState<string>('calls-search', () => '')
  const listingSearchText = useState<string>('calls-listing-search-text', () => '')
  const activeCallsFilter = useState<PhoneCallStatus | 'unmatched' | 'all'>('calls-active-filter', () => 'all')
  const staffFilter = useState<string>('calls-staff-filter', () => 'all')
  const activeListingFilter = useState<string[]>('calls-active-listing-filter', () => [])
  const activeTagFilters = useState<string[]>('calls-active-tag-filters', () => [])
  const dateRange = useState<CallsDateRange>('calls-date-range', () => 'all')
  const filterOpen = useState<boolean>('calls-filter-open', () => false)

  const threeCX = useThreeCX()
  const threeCxCalls = useThreeCxCalls()
  const inbox = useInbox()
  const { isGro, activeTenantId } = useGroScope()

  const matchedCalls = computed<Array<PhoneCall & { _guestName: string, _listingName: string, _staffId: string | null, _extensionNumber: string | null }>>(() => {
    const calls = threeCxCalls.allCalls.value
    const rows: Array<PhoneCall & { _guestName: string, _listingName: string, _staffId: string | null, _extensionNumber: string | null }> = []
    for (const call of calls) {
      const conv = inbox.conversations.value.find(c => c.id === call.conversationId)
      if (!conv)
        continue
      rows.push({
        ...call,
        _guestName: conv.guestName,
        _listingName: conv.listingName,
        _staffId: call.staffId ?? null,
        _extensionNumber: call.extensionNumber ?? null,
      })
    }
    return rows
  })

  const unmatchedRows = computed(() => threeCX.unmatchedCalls.value)

  const dateRangeBounds = computed(() => {
    const now = new Date()
    if (dateRange.value === 'today')
      return { start: startOfDay(now), end: endOfDay(now) }
    if (dateRange.value === 'last-7-days')
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) }
    if (dateRange.value === 'last-30-days')
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) }
    return null
  })

  const filteredMatched = computed(() => {
    if (activeCallsFilter.value === 'unmatched')
      return []
    let result = matchedCalls.value
    if (isGro.value && activeTenantId.value !== 'all') {
      result = result.filter((c) => {
        const conv = inbox.conversations.value.find(cv => cv.id === c.conversationId)
        return conv ? resolveConversationTenantId(conv) === activeTenantId.value : false
      })
    }
    if (activeCallsFilter.value !== 'all')
      result = result.filter(c => c.status === activeCallsFilter.value)
    if (staffFilter.value !== 'all') {
      if (staffFilter.value === 'unassigned')
        result = result.filter(c => !c._staffId)
      else result = result.filter(c => c._staffId === staffFilter.value)
    }
    if (activeListingFilter.value.length > 0)
      result = result.filter(c => activeListingFilter.value.includes(c._listingName))
    if (activeTagFilters.value.length > 0) {
      result = result.filter((c) => {
        const conv = inbox.conversations.value.find(cv => cv.id === c.conversationId)
        if (!conv)
          return false
        return activeTagFilters.value.every(tag => conv.tags.includes(tag))
      })
    }
    if (dateRangeBounds.value) {
      const { start, end } = dateRangeBounds.value
      result = result.filter((c) => {
        const d = new Date(c.timestamp)
        return d >= start && d <= end
      })
    }
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter((c) => {
        return c._guestName.toLowerCase().includes(q)
          || c._listingName.toLowerCase().includes(q)
          || c.from.toLowerCase().includes(q)
          || c.to.toLowerCase().includes(q)
      })
    }
    return result
  })

  const filteredUnmatched = computed(() => {
    // Unmatched calls have no conversation/tenant link, so they only appear
    // under the "All tenants" scope for a GRO.
    if (isGro.value && activeTenantId.value !== 'all')
      return []
    let result = unmatchedRows.value
    if (activeCallsFilter.value === 'all' || activeCallsFilter.value === 'unmatched') {
      // keep all
    }
    else if (activeCallsFilter.value === 'missed' || activeCallsFilter.value === 'voicemail' || activeCallsFilter.value === 'completed') {
      result = result.filter((c: UnmatchedCall) => c.status === activeCallsFilter.value)
    }
    else {
      return []
    }
    if (dateRangeBounds.value) {
      const { start, end } = dateRangeBounds.value
      result = result.filter((c: UnmatchedCall) => {
        const d = new Date(c.timestamp)
        return d >= start && d <= end
      })
    }
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter((c: UnmatchedCall) => {
        return c.fromNumber.toLowerCase().includes(q) || c.toExtension.toLowerCase().includes(q)
      })
    }
    return result
  })

  const listingOptions = computed(() => {
    const set = new Set<string>()
    for (const c of matchedCalls.value)
      set.add(c._listingName)
    const opts = Array.from(set).sort().map(name => ({ name, count: matchedCalls.value.filter(c => c._listingName === name).length }))
    if (!listingSearchText.value)
      return opts
    const q = listingSearchText.value.toLowerCase()
    return opts.filter(o => o.name.toLowerCase().includes(q))
  })

  const listingTags = computed(() => {
    const map = new Map<string, number>()
    for (const call of matchedCalls.value) {
      const conv = inbox.conversations.value.find(c => c.id === call.conversationId)
      if (!conv)
        continue
      for (const tag of conv.tags) {
        map.set(tag, (map.get(tag) ?? 0) + 1)
      }
    }
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
  })

  function toggleTagFilter(tag: string) {
    const current = [...activeTagFilters.value]
    const idx = current.indexOf(tag)
    if (idx === -1)
      current.push(tag)
    else current.splice(idx, 1)
    activeTagFilters.value = current
  }

  function clearTagFilters() {
    activeTagFilters.value = []
  }

  const statusSummary = computed(() => ({
    total: filteredMatched.value.length,
    completed: filteredMatched.value.filter(c => c.status === 'completed').length,
    missed: filteredMatched.value.filter(c => c.status === 'missed').length,
    voicemail: filteredMatched.value.filter(c => c.status === 'voicemail').length,
    unmatched: filteredUnmatched.value.length,
  }))

  const filterCount = computed(() => {
    let c = 0
    if (activeCallsFilter.value !== 'all') c++
    if (staffFilter.value !== 'all') c++
    if (activeListingFilter.value.length > 0) c++
    if (dateRange.value !== 'all') c++
    return c
  })

  function clearFilters() {
    activeCallsFilter.value = 'all'
    staffFilter.value = 'all'
    activeListingFilter.value = []
    activeTagFilters.value = []
    dateRange.value = 'all'
    searchQuery.value = ''
  }

  function toggleListingFilter(name: string) {
    const current = [...activeListingFilter.value]
    const idx = current.indexOf(name)
    if (idx === -1)
      current.push(name)
    else current.splice(idx, 1)
    activeListingFilter.value = current
  }

  function clearListingFilters() {
    activeListingFilter.value = []
  }

  function callsCountByStatus(status: PhoneCallStatus | 'unmatched' | 'all'): number {
    if (status === 'all')
      return matchedCalls.value.length + unmatchedRows.value.length
    if (status === 'unmatched')
      return unmatchedRows.value.length
    return matchedCalls.value.filter(c => c.status === status).length
  }

  return {
    searchQuery,
    activeCallsFilter,
    staffFilter,
    activeListingFilter,
    toggleListingFilter,
    clearListingFilters,
    activeTagFilters,
    toggleTagFilter,
    clearTagFilters,
    listingTags,
    dateRange,
    filterOpen,
    matchedCalls,
    unmatchedRows,
    filteredMatched,
    filteredUnmatched,
    listingOptions,
    listingSearchText,
    statusSummary,
    callsCountByStatus,
    filterCount,
    dateRangeBounds,
    clearFilters,
  }
}
