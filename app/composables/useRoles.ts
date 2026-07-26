// app/composables/useRoles.ts
import type { NotificationChannel } from '~/components/notifications/data/notification-settings'
import type { Role, RoleId } from '~/components/users/data/roles'
import {
  normalizeRoleNotifications,
  notificationChannels,
} from '~/components/notifications/data/notification-settings'
import { defaultPerms } from '~/components/users/data/permissions'
import { defaultRoles, findDefaultRole } from '~/components/users/data/roles'

const STORAGE_KEY = 'elev8-tenant-roles'
const ALLOWED_NOTIFICATION_CHANNELS = new Set(
  notificationChannels.map(channel => channel.value),
)

function normalizeNotifications(value: unknown, roleId: RoleId): Role['notifications'] {
  // Run the canonical normalizer first so a fully valid payload (or a
  // missing/invalid payload) lands on the role's defaults. Then, if the
  // caller supplied a non-empty `channels` array that survived the
  // strict sanitizer, preserve that channel override on top of the
  // canonical defaults. This handles the brief's "empty alert types +
  // email channel" save case: `normalizeRoleNotifications` would fall back
  // to role defaults because the alert list is empty, but the role editor
  // still needs to persist the user's chosen channel. Roles whose owner
  // defaults are intentionally empty (e.g. `role-owner`) keep their empty
  // alert list because the canonical defaults supply it.
  const normalized = normalizeRoleNotifications(value, roleId)
  if (!value || typeof value !== 'object')
    return normalized

  const channels = (value as { channels?: unknown }).channels
  if (!Array.isArray(channels))
    return normalized

  const validChannels = Array.from(new Set(channels.filter(
    (channel): channel is NotificationChannel =>
      typeof channel === 'string'
      && ALLOWED_NOTIFICATION_CHANNELS.has(channel as NotificationChannel),
  )))

  return validChannels.length > 0
    ? { ...normalized, channels: validChannels }
    : normalized
}

function hasStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

function mergeWithDefaults(roles: Role[]): Role[] {
  const defaults = defaultPerms()
  return roles.map(role => ({
    ...role,
    defaultPermissions: {
      ...defaults,
      ...role.defaultPermissions,
    },
    notifications: normalizeNotifications(role.notifications, role.id),
  }))
}

function loadFromStorage(): Role[] | null {
  if (!hasStorage())
    return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw)
      return null
    return mergeWithDefaults(JSON.parse(raw) as Role[])
  }
  catch {
    return null
  }
}

function saveToStorage(roles: Role[]): void {
  if (!hasStorage())
    return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(roles))
  }
  catch {
    // ignore quota errors
  }
}

export function useRoles() {
  const roles = useState<Role[]>('tenant-roles', () => {
    const stored = loadFromStorage()
    return stored ?? JSON.parse(JSON.stringify(defaultRoles))
  })

  function getRole(id: string): Role | undefined {
    return roles.value.find(r => r.id === id)
  }

  function updateRole(id: RoleId, patch: Partial<Omit<Role, 'id'>>): void {
    roles.value = roles.value.map((role) => {
      if (role.id !== id)
        return role
      const updated = { ...role, ...patch }
      return {
        ...updated,
        notifications: normalizeNotifications(updated.notifications, updated.id),
      }
    })
    saveToStorage(roles.value)
  }

  function resetRoleToDefaults(id: RoleId): void {
    const defaults = findDefaultRole(id)
    if (!defaults)
      return
    const fresh = JSON.parse(JSON.stringify(defaults))
    roles.value = roles.value.map(r => r.id === id ? fresh : r)
    saveToStorage(roles.value)
  }

  function resetAllRolesToDefaults(): void {
    roles.value = JSON.parse(JSON.stringify(defaultRoles))
    saveToStorage(roles.value)
  }

  return {
    roles,
    getRole,
    updateRole,
    resetRoleToDefaults,
    resetAllRolesToDefaults,
  }
}
