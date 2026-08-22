<!-- app/components/users/UsersTable.vue -->
<script setup lang="ts">
import type { User } from '~/components/users/data/users'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'
import { Input } from '~/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Switch } from '~/components/ui/switch'
import { useRoles } from '~/composables/useRoles'
import { useUsers } from '~/composables/useUsers'

const emit = defineEmits<{
  edit: [user: User]
}>()

const { users, toggleActive, deleteUser } = useUsers()
const { roles, getRole } = useRoles()

function goToUser(user: User) {
  return navigateTo(`/users/${user.id}`)
}

// Deterministic per-name avatar color — consistent with the owner avatars.
const AVATAR_COLORS = [
  'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  'bg-lime-500/10 text-lime-700 dark:text-lime-300',
]

function avatarColorFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!
}

// Listings as {id, name} objects — used for the "All listings" filter dropdown
// and per-row assignment chips. `User.listingIds` holds Listing.id values (e.g. 'lst-1'),
// so we map through `listings` (the ref<Listing[]>) rather than `allProperties`
// (a ComputRef<string[]> of unique property names).
const allListingOptions = computed(() =>
  listings.value.map(l => ({ id: l.id, name: l.name })),
)

// Filters
const search = ref('')
const roleFilter = ref<string>('all')
const listingFilter = ref<string>('all')
const statusFilter = ref<string>('all')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const options = allListingOptions.value
  const optionById = new Map(options.map(o => [o.id, o]))
  return users.value
    .filter((u) => {
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q))
        return false
      if (roleFilter.value !== 'all' && u.roleId !== roleFilter.value)
        return false
      if (listingFilter.value !== 'all' && !u.listingIds.includes(listingFilter.value))
        return false
      if (statusFilter.value !== 'all' && u.status !== statusFilter.value)
        return false
      return true
    })
    .map((u) => {
      const listingNames: { name: string, id: string }[] = []
      for (const id of u.listingIds) {
        const o = optionById.get(id)
        if (o)
          listingNames.push({ name: o.name, id: o.id })
      }
      return { user: u, listingNames }
    })
})

function handleDelete(user: User) {
  if (confirm(`Delete user "${user.name}"? This cannot be undone.`)) {
    deleteUser(user.id)
    toast.error(`User ${user.name} deleted`)
  }
}

function handleToggleActive(user: User) {
  const willActivate = user.status !== 'active'
  toggleActive(user.id)
  toast.info(willActivate ? `User ${user.name} activated` : `User ${user.name} deactivated`)
}

// Pagination
const PAGE_SIZE = 8
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))

const pagedUsers = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filtered.value.slice(start, start + PAGE_SIZE)
})

watch([search, roleFilter, listingFilter, statusFilter], () => {
  page.value = 1
})

function pageNumbers(): (number | 'ellipsis')[] {
  const total = totalPages.value
  if (total <= 5)
    return Array.from({ length: total }, (_, i) => i + 1)
  const current = page.value
  const pages = new Set<number>([1, total, current - 1, current, current + 1])
  const sorted = Array.from(pages).filter(p => p >= 1 && p <= total).sort((a, b) => a - b)
  const result: (number | 'ellipsis')[] = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1)
      result.push('ellipsis')
    result.push(p)
    prev = p
  }
  return result
}
</script>

<template>
  <div class="space-y-3">
    <!-- Filter bar -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative flex-1 min-w-48 max-w-sm">
        <Icon name="lucide:search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input v-model="search" placeholder="Search by name or email..." class="pl-8" />
      </div>

      <Select v-model="roleFilter">
        <SelectTrigger class="w-44">
          <SelectValue placeholder="Role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All roles
          </SelectItem>
          <SelectItem v-for="r in roles" :key="r.id" :value="r.id">
            {{ r.name }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="listingFilter">
        <SelectTrigger class="w-44">
          <SelectValue placeholder="Listing" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All listings
          </SelectItem>
          <SelectItem v-for="p in allListingOptions" :key="p.id" :value="p.id">
            {{ p.name }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="statusFilter">
        <SelectTrigger class="w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All status
          </SelectItem>
          <SelectItem value="active">
            Active
          </SelectItem>
          <SelectItem value="inactive">
            Inactive
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Table -->
    <div class="rounded-md border overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th class="text-left font-medium px-4 py-3">
              User
            </th>
            <th class="text-left font-medium px-4 py-3">
              Role
            </th>
            <th class="text-left font-medium px-4 py-3">
              Listings
            </th>
            <th class="text-left font-medium px-4 py-3">
              Status
            </th>
            <th class="text-right font-medium px-4 py-3 w-12">
              <span class="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="{ user: u, listingNames } in pagedUsers"
            :key="u.id"
            class="border-t hover:bg-muted/30 transition-colors cursor-pointer"
            tabindex="0"
            @click="goToUser(u)"
            @keydown.enter.prevent="goToUser(u)"
            @keydown.space.prevent="goToUser(u)"
          >
            <td class="px-4 py-3">
              <NuxtLink
                :to="`/users/${u.id}`"
                class="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                @click.stop
              >
                <Avatar class="size-9">
                  <AvatarFallback :class="avatarColorFor(u.name)" class="text-xs">
                    {{ u.initials }}
                  </AvatarFallback>
                </Avatar>
                <div class="min-w-0">
                  <div class="font-medium truncate">
                    {{ u.name }}
                  </div>
                  <div class="text-xs text-muted-foreground truncate">
                    {{ u.email }}
                  </div>
                </div>
              </NuxtLink>
            </td>

            <td class="px-4 py-3">
              <Badge variant="secondary">
                {{ getRole(u.roleId)?.name ?? 'Unknown' }}
              </Badge>
            </td>

            <td class="px-4 py-3">
              <div v-if="u.listingIds.length === 0" class="inline-flex items-center gap-1 text-xs text-muted-foreground italic">
                <Icon name="lucide:globe" class="size-3" />
                All listings
              </div>
              <div v-else class="flex flex-wrap gap-1">
                <Badge
                  v-for="p in listingNames.slice(0, 2)"
                  :key="p.id"
                  variant="outline"
                  class="text-xs"
                >
                  {{ p.name }}
                </Badge>
                <Badge v-if="listingNames.length > 2" variant="outline" class="text-xs">
                  +{{ listingNames.length - 2 }}
                </Badge>
              </div>
            </td>

            <td class="px-4 py-3" @click.stop>
              <Switch
                :model-value="u.status === 'active'"
                @update:model-value="() => handleToggleActive(u)"
              />
            </td>

            <td class="px-4 py-3 text-right" @click.stop>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-8">
                    <Icon name="lucide:more-horizontal" class="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="emit('edit', u)">
                    <Icon name="lucide:pencil" class="mr-2 size-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="handleToggleActive(u)">
                    <Icon :name="u.status === 'active' ? 'lucide:user-x' : 'lucide:user-check'" class="mr-2 size-4" />
                    {{ u.status === 'active' ? 'Deactivate' : 'Activate' }}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem class="text-destructive" @click="handleDelete(u)">
                    <Icon name="lucide:trash-2" class="mr-2 size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </td>
          </tr>

          <tr v-if="filtered.length === 0">
            <td colspan="5" class="px-4 py-12 text-center text-sm text-muted-foreground">
              <div class="flex flex-col items-center gap-2">
                <Icon name="lucide:users-round" class="size-8 opacity-50" />
                <p v-if="users.length === 0">
                  No users yet — add your first team member.
                </p>
                <p v-else>
                  No users match your filters.
                </p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="filtered.length > PAGE_SIZE" class="flex flex-wrap items-center justify-between gap-4">
      <div class="text-xs text-muted-foreground">
        Showing {{ (page - 1) * PAGE_SIZE + 1 }}–{{ Math.min(page * PAGE_SIZE, filtered.length) }} of {{ filtered.length }} users
      </div>
      <div class="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          :disabled="page === 1"
          @click="page > 1 && page--"
        >
          <Icon name="lucide:chevron-left" class="size-4" />
        </Button>
        <template v-for="(p, i) in pageNumbers()" :key="p === 'ellipsis' ? `ellipsis-${i}` : p">
          <span v-if="p === 'ellipsis'" class="px-1 text-sm text-muted-foreground">…</span>
          <Button
            v-else
            variant="ghost"
            size="sm"
            class="min-w-8 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
            :data-active="page === p || undefined"
            @click="page = p"
          >
            {{ p }}
          </Button>
        </template>
        <Button
          variant="outline"
          size="sm"
          :disabled="page === totalPages"
          @click="page < totalPages && page++"
        >
          <Icon name="lucide:chevron-right" class="size-4" />
        </Button>
      </div>
    </div>

    <div v-else class="text-xs text-muted-foreground">
      Showing {{ filtered.length }} of {{ users.length }} users
    </div>
  </div>
</template>
