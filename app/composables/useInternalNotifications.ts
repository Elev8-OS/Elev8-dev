import type { NotificationCopy, NotificationSurface } from '~/components/inbox/data/internal'
import { toast } from 'vue-sonner'

/** The browser's permission, or `unsupported` where there is no Notification API. */
export type NativeNotificationPermission = NotificationPermission | 'unsupported'

function readPermission(): NativeNotificationPermission {
  if (typeof Notification === 'undefined')
    return 'unsupported'
  return Notification.permission
}

/** The dashboard tab is the one in front. Treated as visible where there is no document. */
export function isTabVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible'
}

/**
 * The delivery end of internal staff messaging: puts a colleague's message in
 * front of you as a toast or a native browser notification. It never writes
 * to the notification bell (see `notificationSurfaceFor`).
 *
 * Deliberately knows nothing about rooms: `useInternalInbox` decides whether
 * and where a message surfaces and hands over the words and what "Open" does,
 * so this stays free of an import cycle with the room store.
 */
export function useInternalNotifications() {
  const permission = useState<NativeNotificationPermission>('internal-notify-permission', readPermission)
  /** Inbox > Internal is mounted and on screen. Written by `inbox/Layout.vue`. */
  const internalViewOpen = useState<boolean>('internal-inbox-view-open', () => false)

  /**
   * Asks the browser for permission. Must run from a click: browsers ignore a
   * request that no user gesture started.
   */
  async function requestPermission(): Promise<NativeNotificationPermission> {
    if (typeof Notification === 'undefined') {
      permission.value = 'unsupported'
      return permission.value
    }
    permission.value = await Notification.requestPermission()
    return permission.value
  }

  function show(
    surface: NotificationSurface,
    payload: NotificationCopy & { tag: string, onOpen: () => void },
  ) {
    if (surface === 'none')
      return

    if (surface === 'native' && permission.value === 'granted' && typeof Notification !== 'undefined') {
      // One per room: the tag makes a new message replace the last one from
      // the same room instead of stacking a pile of them.
      const native = new Notification(payload.title, {
        body: `${payload.body}\n${payload.listing}`,
        tag: payload.tag,
      })
      native.onclick = () => {
        window.focus()
        payload.onOpen()
        native.close()
      }
      return
    }

    // A toast, which is also the fallback for a background tab without
    // permission: sonner holds its timer while the tab is hidden, so the toast
    // is still there when you come back. Same id per room, so it updates in
    // place rather than stacking.
    toast.info(payload.title, {
      id: payload.tag,
      description: `${payload.listing} · ${payload.body}`,
      action: { label: 'Open', onClick: payload.onOpen },
    })
  }

  return { permission, internalViewOpen, requestPermission, show }
}
