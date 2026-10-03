/**
 * How-to guidance for housekeeping (Settings > Operations > Guidance): a title,
 * written instructions and YouTube videos. A cleaning step points at guidance
 * by id (`CleaningStep.guidanceIds`).
 *
 * ⚠️ A deliberate live link, not a snapshot: a job's copied steps keep the ids
 * and show the guidance as it is NOW, so a corrected video or instruction
 * reaches every cleaner at once. Deleted guidance simply stops showing
 * (`resolveGuidance` drops unknown ids).
 */
export interface GuidanceVideo {
  id: string
  /** The link as entered, kept for display and for opening on YouTube. */
  url: string
  /** The 11-character YouTube video id, from `parseYouTubeId`. */
  youtubeId: string
  title?: string
}

export interface CleaningGuidance {
  id: string
  title: string
  body: string
  videos: GuidanceVideo[]
  /** An uploaded cover image (data URL). Absent: the first video's thumbnail stands in (`guidanceCoverUrl`). */
  thumbnailUrl?: string
  createdAt: string
  updatedAt: string
}

export const CLEANING_GUIDANCE_STORAGE_KEY = 'elev8-cleaning-guidance-v1'

/**
 * The video id in any common YouTube link (watch, youtu.be, shorts, embed,
 * live, m.youtube), or null when the link is not a YouTube video.
 */
export function parseYouTubeId(input: string): string | null {
  const value = input.trim()
  if (/^[\w-]{11}$/.test(value))
    return value
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
  }
  catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m)\./, '')
  let id: string | null = null
  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0] ?? null
  }
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch')
      id = url.searchParams.get('v')
    else
      id = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/)?.[1] ?? null
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null
}

/** Largest thumbnail accepted, as for the invoice logo: it is stored in the browser with the guidance. */
export const GUIDANCE_THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024
export const GUIDANCE_THUMBNAIL_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/** The image a guidance item shows: its uploaded thumbnail, else its first video's, else none. */
export function guidanceCoverUrl(guidance: Pick<CleaningGuidance, 'thumbnailUrl' | 'videos'>): string | null {
  if (guidance.thumbnailUrl)
    return guidance.thumbnailUrl
  const first = guidance.videos[0]
  return first ? youtubeThumbnailUrl(first.youtubeId) : null
}

export function youtubeThumbnailUrl(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`
}

/** Privacy-enhanced embed (no cookies until the viewer presses play). */
export function youtubeEmbedUrl(youtubeId: string): string {
  return `https://www.youtube-nocookie.com/embed/${youtubeId}`
}

export function youtubeWatchUrl(youtubeId: string): string {
  return `https://www.youtube.com/watch?v=${youtubeId}`
}

const seededAt = '2026-09-01T00:00:00.000Z'

/** Text-only seeds: videos are the tenant's own links, added in Settings. */
export const SEED_CLEANING_GUIDANCE: CleaningGuidance[] = [
  {
    id: 'gd-bed',
    title: 'Making a bed to hotel standard',
    body: 'Fitted sheet tight with no wrinkles. Flat sheet seam side up, folded 30 cm over the duvet at the head. Duvet cover buttons at the foot. Pillows standing, open ends facing away from the door. Finish with the runner centred at the foot of the bed.',
    videos: [],
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: 'gd-fridge',
    title: 'Emptying and cleaning the fridge',
    body: 'Throw away all opened food and anything the guest left. Keep sealed welcome items. Remove shelves, wash with warm soapy water, dry fully before refitting. Wipe the door seal; mould there is a Problem with a photo.',
    videos: [],
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: 'gd-chemicals',
    title: 'Chemical safety',
    body: 'Never mix bleach with any other cleaner. Wear gloves for bathroom products. Open a window before spraying. Store every product back in the cleaning cart, never in the guest kitchen.',
    videos: [],
    createdAt: seededAt,
    updatedAt: seededAt,
  },
]
