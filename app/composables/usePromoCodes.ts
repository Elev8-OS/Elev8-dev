import type { PromoCode, PromoCodeStatus, WidgetPromoCodeLink } from '~/components/promo-code/data/promo-codes'
import { bookingWidgets } from '~/components/booking-widget/data/widgets'
import {
  formatChannelRestrictionLabel,
  formatPromoDiscount,
  generatePromoId,
  getChannelRestriction,
  getPromoCodeStatus,
  isPromoCodeExpired,
  widgetPromoCodeLinks as seedLinks,
  promoCodes as seedPromoCodes,
} from '~/components/promo-code/data/promo-codes'

export type PromoCodeDraft = Omit<PromoCode, 'id' | 'createdAt' | 'updatedAt' | 'redemptionCount'> & {
  redemptionCount?: number
}

export interface PromoCodeFilters {
  search: string
  status: PromoCodeStatus | 'all'
  sortBy: 'recent' | 'code' | 'redemptions'
}

function nowIso() {
  return new Date().toISOString()
}

// Normalize a channel restriction draft before persisting. The channel
// is required (no "all channels" state — every code is pinned to one
// surface). Website IDs only matter when channel === 'website'. If the
// host switches the channel away from website, drop the websiteIds list
// so we don't leave stale IDs behind.
function normalizeChannelRestriction(
  draft: PromoCode['channelRestriction'],
): PromoCode['channelRestriction'] {
  const channel = draft?.channel ?? 'widget'
  const websiteIds = channel === 'website' ? (draft?.websiteIds ?? []) : []
  return { channel, websiteIds }
}

export function usePromoCodes() {
  const codes = useState<PromoCode[]>('promo-codes', () => seedPromoCodes.value)
  const links = useState<WidgetPromoCodeLink[]>('widget-promo-code-links', () => seedLinks.value)

  const filters = ref<PromoCodeFilters>({
    search: '',
    status: 'all',
    sortBy: 'recent',
  })

  const filteredCodes = computed(() => {
    const query = filters.value.search.trim().toLowerCase()
    const result = codes.value.filter((code) => {
      const status = getPromoCodeStatus(code)
      if (filters.value.status !== 'all' && status !== filters.value.status)
        return false
      if (query) {
        const haystack = `${code.code} ${code.description ?? ''}`.toLowerCase()
        if (!haystack.includes(query))
          return false
      }
      return true
    })

    return [...result].sort((a, b) => {
      if (filters.value.sortBy === 'code')
        return a.code.localeCompare(b.code)
      if (filters.value.sortBy === 'redemptions')
        return b.redemptionCount - a.redemptionCount
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  })

  const activeCount = computed(() => codes.value.filter(c => getPromoCodeStatus(c) === 'active').length)
  const expiredCount = computed(() => codes.value.filter(c => getPromoCodeStatus(c) === 'expired').length)
  const inactiveCount = computed(() => codes.value.filter(c => getPromoCodeStatus(c) === 'inactive').length)
  const totalRedemptions = computed(() => codes.value.reduce((sum, c) => sum + c.redemptionCount, 0))

  function isCodeTaken(code: string, excludeId?: string): boolean {
    const target = code.trim().toUpperCase()
    return codes.value.some(c => c.code === target && c.id !== excludeId)
  }

  function getById(id: string): PromoCode | null {
    return codes.value.find(c => c.id === id) ?? null
  }

  function createPromoCode(draft: PromoCodeDraft): PromoCode {
    const now = nowIso()
    const channelRestriction = normalizeChannelRestriction(draft.channelRestriction)
    const code: PromoCode = {
      id: generatePromoId(),
      code: draft.code.trim().toUpperCase(),
      description: draft.description,
      discountType: draft.discountType,
      value: draft.discountType === 'free_upsell' ? 0 : draft.value,
      currency: draft.discountType === 'fixed' ? (draft.currency ?? null) : null,
      active: draft.active,
      bookingWindows: (draft.bookingWindows ?? []).map(w => ({ from: w.from ?? null, until: w.until ?? null })),
      stayWindows: (draft.stayWindows ?? []).map(w => ({ from: w.from ?? null, until: w.until ?? null })),
      usageLimit: draft.usageLimit ?? null,
      redemptionCount: draft.redemptionCount ?? 0,
      createdAt: now,
      updatedAt: now,
      freeUpsellItemIds: draft.discountType === 'free_upsell' ? (draft.freeUpsellItemIds ?? []) : undefined,
      listingIds: draft.listingIds ?? [],
      channelRestriction,
    }
    codes.value = [code, ...codes.value]
    return code
  }

  function updatePromoCode(id: string, patch: Partial<PromoCodeDraft>): PromoCode | null {
    let updated: PromoCode | null = null
    codes.value = codes.value.map((c) => {
      if (c.id !== id)
        return c
      const nextType = patch.discountType ?? c.discountType
      const nextValue = nextType === 'free_upsell' ? 0 : (patch.value ?? c.value)
      const nextCurrency = nextType === 'fixed' ? (patch.currency ?? c.currency ?? null) : null
      const nextBooking = patch.bookingWindows
        ? patch.bookingWindows.map(w => ({ from: w.from ?? null, until: w.until ?? null }))
        : (c.bookingWindows ?? [])
      const nextStay = patch.stayWindows
        ? patch.stayWindows.map(w => ({ from: w.from ?? null, until: w.until ?? null }))
        : (c.stayWindows ?? [])
      const nextChannelRestriction = patch.channelRestriction !== undefined
        ? normalizeChannelRestriction(patch.channelRestriction)
        : c.channelRestriction
      updated = {
        ...c,
        ...patch,
        code: (patch.code ?? c.code).trim().toUpperCase(),
        discountType: nextType,
        value: nextValue,
        currency: nextCurrency,
        bookingWindows: nextBooking,
        stayWindows: nextStay,
        usageLimit: patch.usageLimit ?? c.usageLimit ?? null,
        freeUpsellItemIds: nextType === 'free_upsell' ? (patch.freeUpsellItemIds ?? c.freeUpsellItemIds ?? []) : undefined,
        listingIds: patch.listingIds ?? c.listingIds ?? [],
        channelRestriction: nextChannelRestriction,
        updatedAt: nowIso(),
      }
      return updated
    })
    return updated
  }

  function deletePromoCode(id: string): void {
    codes.value = codes.value.filter(c => c.id !== id)
    links.value = links.value.filter(l => l.promoCodeId !== id)
  }

  function duplicatePromoCode(id: string): PromoCode | null {
    const original = getById(id)
    if (!original)
      return null
    const originalChannel = getChannelRestriction(original)
    return createPromoCode({
      ...original,
      code: `${original.code} (Copy)`,
      active: false,
      redemptionCount: 0,
      freeUpsellItemIds: original.freeUpsellItemIds ? [...original.freeUpsellItemIds] : [],
      listingIds: original.listingIds ? [...original.listingIds] : [],
      channelRestriction: {
        channel: originalChannel.channel,
        websiteIds: [...originalChannel.websiteIds],
      },
    })
  }

  function toggleActive(id: string): void {
    const code = getById(id)
    if (!code)
      return
    updatePromoCode(id, { active: !code.active })
  }

  function setLinksForWidget(widgetId: string, codeIds: string[]): void {
    const existing = links.value.filter(l => l.source === 'widget' && l.sourceId === widgetId)
    const existingIds = new Set(existing.map(l => l.promoCodeId))
    const newIds = new Set(codeIds)
    const addedAt = nowIso()

    // Drop links that are no longer selected
    let next = links.value.filter(l => !(l.source === 'widget' && l.sourceId === widgetId && !newIds.has(l.promoCodeId)))

    // Add new links
    for (const codeId of codeIds) {
      if (!existingIds.has(codeId)) {
        const widget = bookingWidgets.value.find(w => w.id === widgetId)
        const usageCount = widget ? 0 : 0
        next = [
          ...next,
          { promoCodeId: codeId, source: 'widget', sourceId: widgetId, usageCount, addedAt },
        ]
      }
    }

    links.value = next
  }

  function getUsagesByCode(codeId: string): WidgetPromoCodeLink[] {
    return links.value.filter(l => l.promoCodeId === codeId)
  }

  function getLinksForWidget(widgetId: string): WidgetPromoCodeLink[] {
    return links.value.filter(l => l.source === 'widget' && l.sourceId === widgetId)
  }

  function clearFilters(): void {
    filters.value = { search: '', status: 'all', sortBy: 'recent' }
  }

  return {
    codes,
    links,
    filters,
    filteredCodes,
    activeCount,
    expiredCount,
    inactiveCount,
    totalRedemptions,
    isCodeTaken,
    getById,
    getPromoCodeStatus,
    isPromoCodeExpired,
    formatPromoDiscount,
    getChannelRestriction,
    formatChannelRestrictionLabel,
    createPromoCode,
    updatePromoCode,
    deletePromoCode,
    duplicatePromoCode,
    toggleActive,
    setLinksForWidget,
    getUsagesByCode,
    getLinksForWidget,
    clearFilters,
  }
}
