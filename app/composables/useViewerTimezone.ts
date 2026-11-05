import { onMounted, ref } from 'vue'

/**
 * The reader's IANA timezone. The server cannot know it, so the first paint is UTC
 * and the real zone lands after mount: server and client render the same markup first.
 */
export function useViewerTimezone() {
  const zone = ref('UTC')
  onMounted(() => {
    try {
      zone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    }
    catch {
      zone.value = 'UTC'
    }
  })
  return zone
}
