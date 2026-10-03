/**
 * How a listing verifies its guests before arrival, set in the listing's Guest
 * Guide tab. Read through `listingGuestVerification`, which fills the defaults
 * for a listing that never set it.
 */
export type GuestVerificationMode = 'person' | 'group' | 'none'

export interface GuestVerificationSettings {
  mode: GuestVerificationMode
  /** Ask every guest for a residential address. */
  requireAddress: boolean
  /** Ask the guests how they want the beds set up. */
  askBedConfiguration: boolean
}

export const DEFAULT_GUEST_VERIFICATION: GuestVerificationSettings = {
  mode: 'person',
  requireAddress: false,
  askBedConfiguration: false,
}

export const GUEST_VERIFICATION_MODES: Array<{ value: GuestVerificationMode, label: string, short: string, icon: string | null, description: string }> = [
  {
    value: 'person',
    label: 'Verify person',
    short: 'Person',
    icon: 'lucide:user',
    description: 'Each guest must enter their identity details and upload a document.',
  },
  {
    value: 'group',
    label: 'Verify group',
    short: 'Group',
    icon: 'lucide:users',
    description: 'Each guest in the group must enter their identity details, but only one guest needs to upload a document.',
  },
  {
    value: 'none',
    label: 'No Verification',
    short: 'None',
    icon: null,
    description: 'Guests are not asked for identity details or a document.',
  },
]

export function listingGuestVerification(listing: { guestVerification?: Partial<GuestVerificationSettings> } | null | undefined): GuestVerificationSettings {
  return { ...DEFAULT_GUEST_VERIFICATION, ...listing?.guestVerification }
}

/** The short name of a mode, e.g. "Group", for compact places like the tab's section list. */
export function guestVerificationShortLabel(mode: GuestVerificationMode): string {
  return GUEST_VERIFICATION_MODES.find(m => m.value === mode)?.short ?? mode
}
