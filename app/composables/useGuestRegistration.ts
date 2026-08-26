import type { ApoaConnectionDetails, AvsConnectionDetails, FeratelConnectionDetails, GuestRegistration, ListingRegistration, ProviderConnection, RegistrationProvider, RegistrationStatus } from '~/components/guest-registration/data/guest-registration'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { buildApoaPayload, buildAvsPayload, buildFeratelPayload, generateRegistrationId, isRegistrationComplete, isReportingRequired, mockSubmitToGovernment } from '~/components/guest-registration/data/guest-registration'
import { listings } from '~/components/listings/data/listings'
import { useReservationsModule } from '~/composables/useReservationsModule'

const CONNECTIONS_KEY = 'elev8-guest-registration-connections'
const LISTING_REGISTRATIONS_KEY = 'elev8-guest-registration-listings'
const REGISTRATIONS_KEY = 'elev8-guest-registration-records'

const OVERDUE_HOURS = 24

function loadFromStorage<T>(key: string, fallback: T): T {
  if (import.meta.client) {
    try {
      const raw = localStorage.getItem(key)
      if (raw)
        return JSON.parse(raw) as T
    }
    catch { /* ignore */ }
  }
  return fallback
}

function saveToStorage<T>(key: string, value: T) {
  if (import.meta.client) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    }
    catch { /* ignore */ }
  }
}

export interface GuestRegistrationFilters {
  search: string
  provider: RegistrationProvider | 'all'
  status: RegistrationStatus | 'all'
}

export function useGuestRegistration() {
  const notifications = useNotifications()
  const connections = useState<ProviderConnection[]>('guest-registration-connections', () =>
    loadFromStorage<ProviderConnection[]>(CONNECTIONS_KEY, []))
  const listingRegistrations = useState<ListingRegistration[]>('guest-registration-listings', () =>
    loadFromStorage<ListingRegistration[]>(LISTING_REGISTRATIONS_KEY, []))
  const registrations = useState<GuestRegistration[]>('guest-registration-records', () =>
    loadFromStorage<GuestRegistration[]>(REGISTRATIONS_KEY, []))

  watch(connections, val => saveToStorage(CONNECTIONS_KEY, val), { deep: true })
  watch(listingRegistrations, val => saveToStorage(LISTING_REGISTRATIONS_KEY, val), { deep: true })
  watch(registrations, val => saveToStorage(REGISTRATIONS_KEY, val), { deep: true })

  const filters = ref<GuestRegistrationFilters>({ search: '', provider: 'all', status: 'all' })

  function isConnected(provider: RegistrationProvider): boolean {
    return connections.value.some(c => c.provider === provider && c.status === 'connected')
  }

  const connectedProviders = computed(() => connections.value.filter(c => c.status === 'connected'))

  /** All connected accounts for a provider (a provider can have multiple accounts). */
  function getConnections(provider: RegistrationProvider): ProviderConnection[] {
    return connections.value.filter(c => c.provider === provider && c.status === 'connected')
  }

  /** Resolve the account that owns a listing for a provider (reports route to it). */
  function getAccountForListing(listingId: string, provider: RegistrationProvider): ProviderConnection | undefined {
    const reg = getListingRegistration(listingId)
    const accountId = reg?.[provider]?.accountId
    if (!accountId)
      return undefined
    return connections.value.find(c => c.id === accountId && c.provider === provider && c.status === 'connected')
  }

  /** Is the listing already assigned to a different account for this provider? */
  function isListingTaken(listingId: string, provider: RegistrationProvider, excludeAccountId?: string): boolean {
    const reg = getListingRegistration(listingId)
    const accountId = reg?.[provider]?.accountId
    if (!accountId)
      return false
    return accountId !== excludeAccountId
  }

  /** Listing → account assignment for a provider. */
  function assignListingToAccount(listingId: string, provider: RegistrationProvider, accountId: string) {
    const current = getListingRegistration(listingId)
    const updated: ListingRegistration = {
      listingId,
      ...current,
      [provider]: {
        registered: true,
        accountId,
        ...(provider === 'apoa' ? { accommodationId: `ACCOM-${listingId.toUpperCase().replace(/[^A-Z0-9]/g, '')}` } : { propertyId: `PROP-${listingId.toUpperCase().replace(/[^A-Z0-9]/g, '')}` }),
      },
    }
    listingRegistrations.value = listingRegistrations.value.filter(l => l.listingId !== listingId)
    listingRegistrations.value = [...listingRegistrations.value, updated]
  }

  /** Batch-assign listings to an account for a provider (WhatsApp bulk-assign pattern). */
  function bulkAssignListings(listingIds: string[], provider: RegistrationProvider, accountId: string) {
    for (const id of listingIds) {
      if (!isListingTaken(id, provider, accountId))
        assignListingToAccount(id, provider, accountId)
    }
  }

  function unassignListing(listingId: string, provider: RegistrationProvider) {
    const current = getListingRegistration(listingId)
    if (!current?.[provider])
      return
    const updated: ListingRegistration = {
      ...current,
      listingId,
      [provider]: {
        registered: false,
        accountId: undefined,
        ...(provider === 'apoa' ? { accommodationId: undefined } : { propertyId: undefined }),
      },
    }
    listingRegistrations.value = listingRegistrations.value.filter(l => l.listingId !== listingId)
    listingRegistrations.value = [...listingRegistrations.value, updated]
  }

  function getListingRegistration(listingId: string): ListingRegistration | undefined {
    return listingRegistrations.value.find(l => l.listingId === listingId)
  }

  /** Is a listing registered with any account for a provider? */
  function isListingRegistered(listingId: string, provider: RegistrationProvider): boolean {
    return getListingRegistration(listingId)?.[provider]?.registered ?? false
  }

  const listingOptions = computed(() => listings.value.map(l => ({
    id: l.id,
    name: l.name,
    location: l.location,
    tags: l.tags ?? [],
  })))

  const pendingCount = computed(() => registrations.value.filter(r => r.status === 'pending').length)
  const incompleteCount = computed(() => registrations.value.filter(r => r.status === 'incomplete').length)
  const reportedCount = computed(() => registrations.value.filter(r => r.status === 'submitted').length)
  const failedCount = computed(() => registrations.value.filter(r => r.status === 'failed').length)

  const stats = computed(() => ({
    pending: pendingCount.value,
    incomplete: incompleteCount.value,
    reported: reportedCount.value,
    failed: failedCount.value,
  }))

  const filteredRegistrations = computed(() => {
    return registrations.value.filter((r) => {
      if (filters.value.provider !== 'all' && r.provider !== filters.value.provider)
        return false
      if (filters.value.status !== 'all' && r.status !== filters.value.status)
        return false
      if (filters.value.search) {
        const q = filters.value.search.toLowerCase()
        const haystack = `${r.guestName} ${r.listingName} ${r.nationality ?? ''} ${r.idNumber ?? ''}`.toLowerCase()
        if (!haystack.includes(q))
          return false
      }
      return true
    })
  })

  function getRegistrationsForReservation(reservationId: string): GuestRegistration[] {
    return registrations.value.filter(r => r.reservationId === reservationId)
  }

  /**
   * Connect a new account for a provider (mock OAuth, ~1s).
   * Multiple accounts per provider are supported — each can own different listings.
   */
  async function connectProvider(provider: RegistrationProvider, details: { apoa?: ApoaConnectionDetails, avs?: AvsConnectionDetails, feratel?: FeratelConnectionDetails }): Promise<{ success: boolean, error?: string }> {
    await new Promise(r => setTimeout(r, 1000))
    const connection: ProviderConnection = {
      id: `${provider}-${Date.now()}`,
      provider,
      status: 'connected',
      connectedAt: new Date().toISOString(),
      ...(provider === 'apoa' ? { apoa: details.apoa } : provider === 'feratel' ? { feratel: details.feratel } : { avs: details.avs }),
    }
    connections.value = [...connections.value, connection]
    return { success: true }
  }

  function disconnectProvider(provider: RegistrationProvider, accountId: string) {
    connections.value = connections.value.filter(c => !(c.provider === provider && c.id === accountId))
    // Listing mappings + registration records are preserved (WhatsApp/3CX disconnect pattern).
    // Listings owned by this account become unassigned.
    listingRegistrations.value = listingRegistrations.value.map((l) => {
      if (l[provider]?.accountId !== accountId)
        return l
      return {
        ...l,
        [provider]: {
          registered: false,
          accountId: undefined,
          ...(provider === 'apoa' ? { accommodationId: undefined } : { propertyId: undefined }),
        },
      }
    })
  }

  /**
   * Build the registrations for a reservation's occupants (per provider, idempotent).
   * APOA: foreign nationals only; AVS & Feratel: every guest. `inquiry` stays are excluded.
   */
  function syncForReservation(reservation: ReservationEntry) {
    if (reservation.status === 'inquiry' || reservation.status === 'cancelled' || reservation.status === 'blocked')
      return
    if (!reservation.guests?.length)
      return
    for (const provider of ['apoa', 'avs', 'feratel'] as const) {
      if (!isConnected(provider))
        continue
      const listing = listings.value.find(l => l.id === reservation.listingId)
      // Reports route to the account that owns this listing (if any).
      const accountId = getListingRegistration(reservation.listingId)?.[provider]?.accountId
      for (const occupant of reservation.guests) {
        if (!isReportingRequired(provider, occupant))
          continue
        const exists = registrations.value.some(r =>
          r.reservationId === reservation.id
          && r.occupantId === occupant.id
          && r.provider === provider,
        )
        if (exists)
          continue
        const reg: GuestRegistration = {
          id: generateRegistrationId(),
          provider,
          accountId,
          reservationId: reservation.id,
          channel: reservation.channel,
          listingId: reservation.listingId,
          listingName: listing?.name ?? reservation.listingName,
          guestName: occupant.name,
          occupantId: occupant.id,
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          nationality: occupant.nationality,
          idType: occupant.idType,
          idNumber: occupant.idNumber,
          dob: occupant.dob,
          placeOfBirth: undefined,
          gender: undefined,
          visaType: provider === 'apoa' ? 'Visa on Arrival' : undefined,
          visaNumber: provider === 'apoa' ? '' : undefined,
          street: provider === 'avs' ? '' : undefined,
          zip: provider === 'avs' ? '' : undefined,
          city: provider === 'avs' ? '' : undefined,
          country: provider === 'avs' ? occupant.nationality : undefined,
          status: isRegistrationComplete({
            guestName: occupant.name,
            nationality: occupant.nationality,
            idType: occupant.idType,
            idNumber: occupant.idNumber,
            dob: occupant.dob,
          })
            ? 'pending'
            : 'incomplete',
          createdAt: new Date().toISOString(),
        }
        registrations.value = [...registrations.value, reg]
      }
    }
  }

  /** Pull in registrations for all currently-staying / upcoming non-inquiry reservations. */
  function syncAllRegistrations() {
    const { reservations } = useReservationsModule()
    for (const reservation of reservations.value)
      syncForReservation(reservation)
  }

  function submitRegistration(id: string): Promise<{ success: boolean, error?: string }> {
    const reg = registrations.value.find(r => r.id === id)
    if (!reg)
      return Promise.resolve({ success: false, error: 'Registration not found.' })
    if (!isConnected(reg.provider))
      return Promise.resolve({ success: false, error: 'Provider is not connected.' })
    if (!isRegistrationComplete(reg))
      return Promise.resolve({ success: false, error: 'Guest data is incomplete. Complete the guest profile first.' })
    if (reg.status === 'submitted')
      return Promise.resolve({ success: false, error: 'Already submitted.' })

    const connection = getAccountForListing(reg.listingId, reg.provider)
    const listing = listings.value.find(l => l.id === reg.listingId)
    const payload = reg.provider === 'apoa'
      ? buildApoaPayload(reg, connection, listing)
      : reg.provider === 'feratel'
        ? buildFeratelPayload(reg, connection, listing)
        : buildAvsPayload(reg, connection, listing)

    return mockSubmitToGovernment(reg.provider, payload).then((result) => {
      if (result.ok && result.submissionId) {
        registrations.value = registrations.value.map(r =>
          r.id === id
            ? { ...r, status: 'submitted' as RegistrationStatus, submittedAt: new Date().toISOString(), submissionId: result.submissionId, error: undefined }
            : r,
        )
        createRegistrationAlert('GUEST_REGISTRATION_SUBMITTED', reg, { submission_id: result.submissionId })
        return { success: true }
      }
      registrations.value = registrations.value.map(r =>
        r.id === id ? { ...r, status: 'failed' as RegistrationStatus, error: result.error ?? 'Submission failed.' } : r,
      )
      createRegistrationAlert('GUEST_REGISTRATION_FAILED', reg, { error: result.error ?? 'Submission failed.' })
      return { success: false, error: result.error ?? 'Submission failed.' }
    })
  }

  function voidRegistration(id: string) {
    registrations.value = registrations.value.map(r => r.id === id ? { ...r, status: 'void' as RegistrationStatus } : r)
  }

  /** Re-submit a failed registration (keeps the original submissionId reference). */
  function resubmitRegistration(id: string): Promise<{ success: boolean, error?: string }> {
    return submitRegistration(id)
  }

  function createRegistrationAlert(type: 'GUEST_REGISTRATION_SUBMITTED' | 'GUEST_REGISTRATION_FAILED', reg: GuestRegistration, extra: Record<string, any>) {
    // Notifications are a side effect and must never reject the submit promise.
    try {
      notifications.createAlert(type, type === 'GUEST_REGISTRATION_FAILED' ? 'WARNING' : 'INFO', {
        guest_name: reg.guestName,
        listing_id: reg.listingId,
        listing_name: reg.listingName,
        provider: reg.provider,
        registration_id: reg.id,
        ...extra,
      })
    }
    catch (err) {
      console.error('Failed to create registration alert', err)
    }
  }

  /** Alert for overdue registrations (report due checkIn + 24h) — mirrors checkOverdueKeys. */
  function checkOverdueRegistrations() {
    const now = new Date()
    registrations.value.forEach((reg) => {
      if (reg.status !== 'pending' && reg.status !== 'incomplete')
        return
      const due = new Date(`${reg.checkIn}T${overdueTimeFor(reg.listingId)}+08:00`)
      due.setHours(due.getHours() + OVERDUE_HOURS)
      if (due > now)
        return
      const hasAlert = notifications.alerts.value.some(a =>
        a.type === 'GUEST_REGISTRATION_OVERDUE' && a.status === 'ACTIVE' && a.context?.registration_id === reg.id,
      )
      if (hasAlert)
        return
      const listing = listings.value.find(l => l.id === reg.listingId)
      notifications.createAlert('GUEST_REGISTRATION_OVERDUE', 'CRITICAL', {
        guest_name: reg.guestName,
        listing_id: reg.listingId,
        listing_name: listing?.name ?? reg.listingName,
        provider: reg.provider,
        registration_id: reg.id,
        check_in: reg.checkIn,
      })
    })
  }

  function overdueTimeFor(listingId: string): string {
    const listing = listings.value.find(l => l.id === listingId)
    return listing?.resources?.basics?.checkInTime ?? '15:00'
  }

  return {
    connections,
    listingRegistrations,
    registrations,
    filters,
    filteredRegistrations,
    stats,
    connectedProviders,
    isConnected,
    getConnections,
    getAccountForListing,
    isListingTaken,
    isListingRegistered,
    getListingRegistration,
    listingOptions,
    getRegistrationsForReservation,
    connectProvider,
    disconnectProvider,
    assignListingToAccount,
    bulkAssignListings,
    unassignListing,
    syncForReservation,
    syncAllRegistrations,
    submitRegistration,
    resubmitRegistration,
    voidRegistration,
    checkOverdueRegistrations,
  }
}
