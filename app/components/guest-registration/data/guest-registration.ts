import type { Listing } from '~/components/listings/data/listings'
import type { GuestOccupant } from '~/components/reservations/data/reservations'

export type RegistrationProvider = 'apoa' | 'avs' | 'feratel'
export type RegistrationStatus = 'pending' | 'incomplete' | 'submitted' | 'failed' | 'void'

export interface ApoaConnectionDetails {
  accommodationName: string
  address: string
  phone: string
  picName: string
}

export interface AvsConnectionDetails {
  /** Optional human-readable account label (e.g. "Elev8 Tourism Office"). */
  accountName?: string
  kurverwaltungId: string
  firmaId: string
  objektId: string
  /** Optional separate object ID used for Airbnb bookings; falls back to `objektId`. */
  objektIdAirbnb?: string
}

export interface FeratelConnectionDetails {
  /** Optional human-readable account label (e.g. "Elev8 Tourism Office"). */
  accountName?: string
  /** MappingCode (betriebnr). */
  mappingCode: string
  /** Community Number (Gemeinde). */
  communityNumber: string
  /** Default country ID (Land). Optional. */
  countryId?: string
}

export interface ProviderConnection {
  id: string
  provider: RegistrationProvider
  status: 'connected' | 'disconnected'
  connectedAt: string
  apoa?: ApoaConnectionDetails
  avs?: AvsConnectionDetails
  feratel?: FeratelConnectionDetails
}

export interface ListingRegistration {
  listingId: string
  apoa?: { registered: boolean, accountId?: string, accommodationId?: string }
  avs?: { registered: boolean, accountId?: string, propertyId?: string }
  feratel?: { registered: boolean, accountId?: string, propertyId?: string }
}

export interface GuestRegistration {
  id: string
  provider: RegistrationProvider
  accountId?: string // which connected account owns this report
  reservationId: string
  /** Source channel of the reservation, used to pick the AVS Objekt ID (Airbnb vs direct). */
  channel?: string
  listingId: string
  listingName: string
  guestName: string
  occupantId: string
  checkIn: string // ISO date
  checkOut: string // ISO date
  // Guest data (mirrors GuestOccupant)
  nationality?: string
  idType?: 'passport' | 'id_card' | 'drivers_license'
  idNumber?: string
  dob?: string
  placeOfBirth?: string
  gender?: string
  // APOA extras
  visaType?: string
  visaNumber?: string
  // AVS extras
  street?: string
  zip?: string
  city?: string
  country?: string
  // Status & proof
  status: RegistrationStatus
  submittedAt?: string
  submissionId?: string // mock government reference
  error?: string
  createdAt: string
}

export const providerLabels: Record<RegistrationProvider, string> = {
  apoa: 'APOA (Indonesia)',
  avs: 'AVS Meldeschein (Germany)',
  feratel: 'Feratel (Austria)',
}

export const statusLabels: Record<RegistrationStatus, string> = {
  pending: 'Pending',
  incomplete: 'Incomplete',
  submitted: 'Submitted',
  failed: 'Failed',
  void: 'Void',
}

export function generateRegistrationId(): string {
  return `reg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Nationalities treated as Indonesian — never reported to APOA. */
const INDONESIAN_NATIONALITIES = new Set([
  'Indonesian',
  'Indonesia',
  'WNI',
  'Indonesia (WNI)',
])

/**
 * APOA obliges reporting of foreign nationals only; AVS Meldeschein reports every guest.
 */
export function isReportingRequired(provider: RegistrationProvider, occupant: GuestOccupant): boolean {
  if (provider === 'avs' || provider === 'feratel')
    return true
  if (occupant.category === 'infant')
    return false // APOA requires passport-holders; infants without docs are skipped
  return !INDONESIAN_NATIONALITIES.has(occupant.nationality ?? '')
}

/** A registration is complete when the fields the government system requires are present. */
export function isRegistrationComplete(reg: Pick<GuestRegistration, 'nationality' | 'idType' | 'idNumber' | 'dob' | 'guestName'>): boolean {
  return !!(reg.guestName?.trim() && reg.nationality?.trim() && reg.idType && reg.idNumber?.trim() && reg.dob?.trim())
}

/** Derive gender from the name — mock heuristic; real data would come from the passport scan. */
function guessGenderFromName(name: string): 'male' | 'female' {
  const femaleMarkers = ['sarah', 'michaela', 'julia', 'olivia', 'emily', 'anna', 'marta', 'hanna', 'lily', 'lisa', 'maria', 'sophie', 'eve', 'grace']
  const lower = name.toLowerCase()
  return femaleMarkers.some(m => lower.includes(m)) ? 'female' : 'male'
}

/** Real-world APOA guest payload shape (Indonesian Ditjen Imigrasi). */
export function buildApoaPayload(reg: GuestRegistration, connection?: ProviderConnection, listing?: Listing) {
  return {
    nama: reg.guestName,
    jenis_kelamin: reg.gender ?? guessGenderFromName(reg.guestName),
    tempat_lahir: reg.placeOfBirth ?? '',
    tanggal_lahir: reg.dob ?? '',
    kewarganegaraan: reg.nationality ?? '',
    jenis_identitas: reg.idType ?? 'passport',
    no_identitas: reg.idNumber ?? '',
    jenis_visa: reg.visaType ?? 'Visa on Arrival',
    no_visa: reg.visaNumber ?? '',
    alamat: connection?.apoa?.address ?? '',
    no_hp: '',
    tanggal_check_in: reg.checkIn,
    tanggal_check_out: reg.checkOut,
    nama_akomodasi: connection?.apoa?.accommodationName ?? '',
    alamat_akomodasi: connection?.apoa?.address ?? '',
    nama_pic: connection?.apoa?.picName ?? '',
    listing_name: listing?.name ?? reg.listingName,
  }
}

/** Real-world AVS Meldeschein guest payload shape (German municipal registration). */
export function buildAvsPayload(reg: GuestRegistration, connection?: ProviderConnection, _listing?: Listing) {
  const nameParts = reg.guestName.trim().split(/\s+/)
  const vorname = nameParts.slice(0, -1).join(' ') || reg.guestName
  const nachname = nameParts.at(-1) ?? ''
  return {
    nachname,
    vorname,
    geburtsdatum: reg.dob ?? '',
    geburtsort: reg.placeOfBirth ?? '',
    staatsangehoerigkeit: reg.nationality ?? '',
    ausweisart: reg.idType === 'id_card' ? 'Personalausweis' : reg.idType === 'drivers_license' ? 'Führerschein' : 'Reisepass',
    ausweisnummer: reg.idNumber ?? '',
    strasse: reg.street ?? '',
    plz: reg.zip ?? '',
    ort: reg.city ?? '',
    land: reg.country ?? reg.nationality ?? '',
    anreise: reg.checkIn,
    abreise: reg.checkOut,
    firma: connection?.avs?.accountName ?? '',
    kurverwaltung_id: connection?.avs?.kurverwaltungId ?? '',
    firma_id: connection?.avs?.firmaId ?? '',
    objekt_id: reg.channel === 'Airbnb'
      ? (connection?.avs?.objektIdAirbnb || connection?.avs?.objektId || '')
      : (connection?.avs?.objektId ?? ''),
  }
}

/** Real-world Feratel Meldewesen guest payload shape (Austrian municipal registration). */
export function buildFeratelPayload(reg: GuestRegistration, connection?: ProviderConnection, _listing?: Listing) {
  const nameParts = reg.guestName.trim().split(/\s+/)
  const vorname = nameParts.slice(0, -1).join(' ') || reg.guestName
  const nachname = nameParts.at(-1) ?? ''
  return {
    betriebnr: connection?.feratel?.mappingCode ?? '',
    gemeinde: connection?.feratel?.communityNumber ?? '',
    land: connection?.feratel?.countryId ?? '',
    nachname,
    vorname,
    geburtsdatum: reg.dob ?? '',
    geburtsort: reg.placeOfBirth ?? '',
    staatsangehoerigkeit: reg.nationality ?? '',
    ausweisart: reg.idType === 'id_card' ? 'Personalausweis' : reg.idType === 'drivers_license' ? 'Führerschein' : 'Reisepass',
    ausweisnummer: reg.idNumber ?? '',
    anreise: reg.checkIn,
    abreise: reg.checkOut,
  }
}

export function generateSubmissionId(provider: RegistrationProvider): string {
  const n = String(Math.floor(10000 + Math.random() * 89999))
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  if (provider === 'apoa')
    return `APOA-${date}-${n}`
  if (provider === 'feratel')
    return `FERATEL-${date}-${n}`
  return `AVS-MELD-${date}-${n}`
}

/**
 * Mock government submission APIs. Real V2 integration would POST these payloads
 * to APOA / the AVS XML interface — here the network layer is simulated while
 * the payloads and state transitions mirror the real flow.
 */
export async function mockSubmitToGovernment(
  provider: RegistrationProvider,
  _payload: Record<string, any>,
): Promise<{ ok: boolean, submissionId?: string, error?: string }> {
  // Simulate network latency (600–1500ms)
  await new Promise(r => setTimeout(r, 600 + Math.random() * 900))
  // ~90% success, 10% failure so the failed state is reachable in demos
  if (Math.random() < 0.1) {
    return {
      ok: false,
      error: provider === 'apoa'
        ? 'APOA returned HTTP 422 — passport number rejected. Check the guest passport data and retry.'
        : provider === 'feratel'
          ? 'Feratel Meldewesen rejected the record — required field "Geburtsdatum" is missing. Complete the guest profile and retry.'
          : 'AVS XML import failed — required field "Geburtsort" is missing. Complete the guest profile and retry.',
    }
  }
  return { ok: true, submissionId: generateSubmissionId(provider) }
}
