/**
 * Listings as they exist on an OTA account, fetched when mapping an account's
 * listings to Elev8 listings. Mock only: the composable generates them.
 */
export interface RemoteListing {
  /** The OTA's own id; becomes `ChannelMapping.externalId` once linked. */
  externalId: string
  title: string
  location: string
}

export interface MatchCandidate {
  id: string
  name: string
  location: string
}

// Words that say nothing about which property a title is.
const STOPWORDS = new Set(['the', 'a', 'an', 'in', 'of', 'by', 'and', 'with', 'near', 'r', 'elev8', 'bali'])

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter(t => (t.length > 1 || /\d/.test(t)) && !STOPWORDS.has(t)))
}

/** Dice coefficient over title and location words, 0 to 1. */
export function matchScore(remote: RemoteListing, candidate: MatchCandidate): number {
  const a = tokens(`${remote.title} ${remote.location}`)
  const b = tokens(`${candidate.name} ${candidate.location}`)
  if (a.size === 0 || b.size === 0)
    return 0
  let shared = 0
  for (const t of a) {
    if (b.has(t))
      shared++
  }
  return (2 * shared) / (a.size + b.size)
}

export const MATCH_THRESHOLD = 0.5

/**
 * Best candidate for a remote listing, or null when nothing is close enough or
 * two candidates tie (a wrong guess is worse than no guess here).
 */
export function suggestMatch(remote: RemoteListing, candidates: MatchCandidate[]): string | null {
  let best: { id: string, score: number } | null = null
  let second = 0
  for (const c of candidates) {
    const score = matchScore(remote, c)
    if (!best || score > best.score) {
      second = best?.score ?? 0
      best = { id: c.id, score }
    }
    else if (score > second) {
      second = score
    }
  }
  if (!best || best.score < MATCH_THRESHOLD || best.score === second)
    return null
  return best.id
}

/**
 * Suggestions for a whole account at once. Each Elev8 listing is suggested for
 * at most one remote listing: when two want the same one, the closer match keeps it.
 */
export function suggestMatches(remotes: RemoteListing[], candidates: MatchCandidate[]): Record<string, string | null> {
  const ranked = remotes
    .map((r) => {
      const id = suggestMatch(r, candidates)
      const candidate = candidates.find(c => c.id === id)
      return { r, id, score: candidate ? matchScore(r, candidate) : 0 }
    })
    .sort((x, y) => y.score - x.score)
  const taken = new Set<string>()
  const result: Record<string, string | null> = {}
  for (const { r, id } of ranked) {
    if (id && !taken.has(id)) {
      taken.add(id)
      result[r.externalId] = id
    }
    else {
      result[r.externalId] = null
    }
  }
  return result
}
