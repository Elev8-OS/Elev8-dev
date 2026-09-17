// useOwnerPayoutDetails — the owner's own bank account and postal address.
//
// Writes go through `saveForCurrentOwner`, which takes the owner id from the
// portal session rather than from its caller. That is the whole security
// model here: a portal page cannot be talked into writing another owner's
// payout account, because it never names one. Staff surfaces read only.

import type { OwnerPayoutDetails, OwnerPayoutDraft, OwnerPayoutErrors } from '~/components/owners/data/owner-payout-details'
import {
  draftToPayoutDetails,
  hasPayoutAccount as hasAccount,
  mockOwnerPayoutDetails,
  OWNER_PAYOUT_STORAGE_KEY,
  payoutAddressLines,
  payoutBankLines,
  validatePayoutDraft,
} from '~/components/owners/data/owner-payout-details'
import { useOwnerAuth } from '~/composables/useOwnerAuth'

export type SavePayoutResult
  = | { ok: true, details: OwnerPayoutDetails }
    | { ok: false, reason: 'no_session' | 'invalid', errors: OwnerPayoutErrors }

/**
 * Guarded on storage availability rather than `import.meta.client`, which
 * Vitest does not substitute — the same rule `useDatev` follows.
 */
function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  }
  catch {
    return null
  }
}

function loadInitial(): OwnerPayoutDetails[] {
  const store = storage()
  if (store) {
    try {
      const raw = store.getItem(OWNER_PAYOUT_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed))
          return parsed as OwnerPayoutDetails[]
      }
    }
    catch {
      // A corrupt entry falls back to the seed rather than blanking the page.
    }
  }
  return structuredClone(mockOwnerPayoutDetails)
}

export function useOwnerPayoutDetails() {
  const auth = useOwnerAuth()
  const payoutDetails = useState<OwnerPayoutDetails[]>('elev8-owner-payout-details', loadInitial)

  function persist() {
    const store = storage()
    if (!store)
      return
    try {
      store.setItem(OWNER_PAYOUT_STORAGE_KEY, JSON.stringify(payoutDetails.value))
    }
    catch {
      // Quota or private mode — the session keeps working, it just will not
      // survive a reload.
    }
  }

  function detailsFor(ownerId: string): OwnerPayoutDetails | undefined {
    return payoutDetails.value.find(entry => entry.ownerId === ownerId)
  }

  const currentDetails = computed(() => {
    const ownerId = auth.session.value?.ownerId
    return ownerId ? detailsFor(ownerId) : undefined
  })

  /** True once there is enough of an account to actually transfer money to. */
  function hasPayoutAccount(ownerId: string): boolean {
    return hasAccount(detailsFor(ownerId))
  }

  /**
   * Save the signed-in owner's details. The owner id comes from the session,
   * never from the caller.
   */
  function saveForCurrentOwner(draft: OwnerPayoutDraft): SavePayoutResult {
    const ownerId = auth.session.value?.ownerId
    if (!ownerId)
      return { ok: false, reason: 'no_session', errors: {} }

    const errors = validatePayoutDraft(draft)
    if (Object.keys(errors).length > 0)
      return { ok: false, reason: 'invalid', errors }

    const details = draftToPayoutDetails(ownerId, draft, new Date().toISOString())
    const existing = payoutDetails.value.some(entry => entry.ownerId === ownerId)
    payoutDetails.value = existing
      ? payoutDetails.value.map(entry => entry.ownerId === ownerId ? details : entry)
      : [...payoutDetails.value, details]
    persist()
    return { ok: true, details }
  }

  return {
    payoutDetails,
    currentDetails,
    detailsFor,
    hasPayoutAccount,
    saveForCurrentOwner,
    // Re-exported so a caller never reaches past the composable for the
    // formatting the PDF and the page must agree on.
    payoutAddressLines,
    payoutBankLines,
  }
}
