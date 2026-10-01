/** "Never", "Just now", "12 min ago", "3 h ago", or a short date. */
export function formatSyncTime(iso: string | null, now = new Date()): string {
  if (!iso)
    return 'Never'
  const then = new Date(iso)
  const minutes = Math.round((now.getTime() - then.getTime()) / 60000)
  if (minutes < 1)
    return 'Just now'
  if (minutes < 60)
    return `${minutes} min ago`
  if (minutes < 24 * 60)
    return `${Math.round(minutes / 60)} h ago`
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
