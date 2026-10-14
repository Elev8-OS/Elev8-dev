import type { WebsiteRuleSet } from '~/components/channels/data/website-channel'
import { computed } from 'vue'
import { parseWebsiteState, ruleSetIssues, upsertRuleSet, WEBSITE_CHANNEL_STORAGE_KEY, websiteChannel } from '~/components/channels/data/website-channel'

let hydrated = false

/**
 * The Website channel on /channels. Only writer of `websiteChannel`.
 * Saved to localStorage; pages call `hydrate()` in onMounted so the server
 * render and the first client render match.
 */
export function useWebsiteChannel() {
  const ruleSets = computed(() => websiteChannel.value.ruleSets)

  function hydrate() {
    if (hydrated || typeof localStorage === 'undefined')
      return
    hydrated = true
    try {
      const saved = parseWebsiteState(localStorage.getItem(WEBSITE_CHANNEL_STORAGE_KEY))
      if (saved)
        websiteChannel.value = saved
    }
    catch {}
  }

  function persist() {
    if (typeof localStorage === 'undefined')
      return
    try {
      localStorage.setItem(WEBSITE_CHANNEL_STORAGE_KEY, JSON.stringify(websiteChannel.value))
    }
    catch {}
  }

  /** Keeps the rule sets, so adding the channel again restores them. */
  function disable() {
    websiteChannel.value = { ...websiteChannel.value, enabled: false }
    persist()
  }

  /** Re-adds a removed channel that still has rule sets. */
  function enable() {
    websiteChannel.value = { ...websiteChannel.value, enabled: true }
    persist()
  }

  function getRuleSet(id: string | null | undefined) {
    return id ? websiteChannel.value.ruleSets.find(r => r.id === id) : undefined
  }

  /**
   * Inserts or updates a rule set and moves its websites out of any other.
   * Saving the first rule set is what adds the channel.
   * Returns the issues and saves nothing when there are any.
   */
  function saveRuleSet(set: WebsiteRuleSet) {
    const issues = ruleSetIssues(set, websiteChannel.value.ruleSets)
    if (issues.length === 0) {
      websiteChannel.value = { enabled: true, ruleSets: upsertRuleSet(websiteChannel.value.ruleSets, { ...set, name: set.name.trim() }) }
      persist()
    }
    return issues
  }

  /** Its websites end up in no rule set. */
  function deleteRuleSet(id: string) {
    if (!getRuleSet(id))
      return false
    websiteChannel.value = { ...websiteChannel.value, ruleSets: websiteChannel.value.ruleSets.filter(r => r.id !== id) }
    persist()
    return true
  }

  /**
   * Puts one website in a rule set (moving it out of any other), or in none
   * with null. For Website Builder, which edits one site at a time.
   */
  function assignWebsite(websiteId: string, ruleSetId: string | null) {
    const ruleSets = websiteChannel.value.ruleSets.map(r => r.id === ruleSetId
      ? (r.websiteIds.includes(websiteId) ? r : { ...r, websiteIds: [...r.websiteIds, websiteId] })
      : (r.websiteIds.includes(websiteId) ? { ...r, websiteIds: r.websiteIds.filter(id => id !== websiteId) } : r))
    websiteChannel.value = { ...websiteChannel.value, ruleSets }
    persist()
  }

  return { websiteChannel, ruleSets, hydrate, assignWebsite, enable, disable, getRuleSet, saveRuleSet, deleteRuleSet }
}
