import type { GuestGuide, GuestGuideLink } from '~/../app/components/guest-guides/data/types'
import type { PublicGuestGuideBranding } from '~/../app/components/settings/data/branding'

// Mirror the type imports. In production these come from a shared package.
export interface PublicGuideResponse {
  link: GuestGuideLink
  guide: GuestGuide
  listing?: any // Listing for fallback data (Wi-Fi, check-in/out, house rules, amenities)
  /**
   * The listing's own guide content (check-in/out steps, house rules, Good to
   * Know), keyed by section type. The listing owns it; sections render it.
   */
  guideContent?: Record<string, Array<{ id: string, title: string, text?: string, photoUrl?: string, icon?: string }>>
  checkIn: string | null
  checkOut: string | null
  branding: PublicGuestGuideBranding
}

export function usePublicGuestGuide() {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBaseUrl

  async function fetchGuide(token: string): Promise<PublicGuideResponse> {
    return await $fetch<PublicGuideResponse>(`${apiBase}/api/guest-guides/by-token/${token}`)
  }

  async function markOpened(token: string): Promise<void> {
    await $fetch(`${apiBase}/api/guest-guides/by-token/${token}/opened`, { method: 'POST' })
  }

  async function submitForm(token: string, data: Record<string, any>): Promise<void> {
    await $fetch(`${apiBase}/api/guest-guides/by-token/${token}/submit`, {
      method: 'POST',
      body: data,
    })
  }

  async function logLockView(token: string): Promise<void> {
    await $fetch(`${apiBase}/api/guest-guides/by-token/${token}/view-lock`, { method: 'POST' })
  }

  return { fetchGuide, markOpened, submitForm, logLockView }
}
