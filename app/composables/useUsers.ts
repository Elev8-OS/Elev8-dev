// app/composables/useUsers.ts
import type { User } from '~/components/users/data/users'
import { computeInitials, seedUsers } from '~/components/users/data/users'
import type { RoleId } from '~/components/users/data/roles'

const STORAGE_KEY = 'elev8-tenant-users'

function hasStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

function loadFromStorage(): User[] | null {
  if (!hasStorage()) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as User[]
  }
  catch {
    return null
  }
}

function saveToStorage(users: User[]): void {
  if (!hasStorage()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(users))
  }
  catch {
    // ignore quota errors
  }
}

function nextUserId(): string {
  return `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export type UserInput = Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'initials'>

export function useUsers() {
  const users = useState<User[]>('tenant-users', () => {
    const stored = loadFromStorage()
    return stored ?? JSON.parse(JSON.stringify(seedUsers))
  })

  function getUser(id: string): User | undefined {
    return users.value.find(u => u.id === id)
  }

  function addUser(input: UserInput): User {
    const now = new Date().toISOString()
    const user: User = {
      ...input,
      id: nextUserId(),
      initials: computeInitials(input.name),
      createdAt: now,
      updatedAt: now,
    }
    users.value = [user, ...users.value]
    saveToStorage(users.value)
    return user
  }

  function updateUser(id: string, patch: Partial<Omit<User, 'id' | 'createdAt'>>): void {
    users.value = users.value.map((u) => {
      if (u.id !== id) return u
      const next = { ...u, ...patch }
      if (patch.name) next.initials = computeInitials(patch.name)
      next.updatedAt = new Date().toISOString()
      return next
    })
    saveToStorage(users.value)
  }

  function deleteUser(id: string): void {
    users.value = users.value.filter(u => u.id !== id)
    saveToStorage(users.value)
  }

  function toggleActive(id: string): void {
    users.value = users.value.map((u) => {
      if (u.id !== id) return u
      return { ...u, status: u.status === 'active' ? 'inactive' : 'active', updatedAt: new Date().toISOString() }
    })
    saveToStorage(users.value)
  }

  function setListingAssignments(userId: string, listingIds: string[]): void {
    updateUser(userId, { listingIds })
  }

  function setTenantAssignments(userId: string, tenantIds: string[]): void {
    updateUser(userId, { assignedTenantIds: tenantIds })
  }

  function getUsersForListing(listingId: string): User[] {
    return users.value.filter(u => u.listingIds.includes(listingId))
  }

  function getUsersByRole(roleId: RoleId): User[] {
    return users.value.filter(u => u.roleId === roleId)
  }

  function findByEmail(email: string): User | undefined {
    const normalized = email.trim().toLowerCase()
    return users.value.find(u => u.email.toLowerCase() === normalized)
  }

  const activeUsers = computed(() => users.value.filter(u => u.status === 'active'))
  const inactiveUsers = computed(() => users.value.filter(u => u.status === 'inactive'))
  const totalCount = computed(() => users.value.length)
  const userCountByRole = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = {}
    for (const u of users.value) {
      counts[u.roleId] = (counts[u.roleId] ?? 0) + 1
    }
    return counts
  })

  return {
    users,
    getUser,
    addUser,
    updateUser,
    deleteUser,
    toggleActive,
    setListingAssignments,
    setTenantAssignments,
    getUsersForListing,
    getUsersByRole,
    findByEmail,
    activeUsers,
    inactiveUsers,
    totalCount,
    userCountByRole,
  }
}
