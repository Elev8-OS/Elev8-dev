<script setup lang="ts">
import type { Owner } from '~/components/owners/data/owners'
import type { Role, RoleId } from '~/components/users/data/roles'
import type { User } from '~/components/users/data/users'
import OwnerDetailSheet from '~/components/owners/OwnerDetailSheet.vue'
import OwnerDocumentsPanel from '~/components/owners/OwnerDocumentsPanel.vue'
import OwnerOnboardingDialog from '~/components/owners/OwnerOnboardingDialog.vue'
import OwnersTable from '~/components/owners/OwnersTable.vue'
import OwnerStatementsPanel from '~/components/owners/OwnerStatementsPanel.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'
import { Skeleton } from '~/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import RoleDetailSheet from '~/components/users/RoleDetailSheet.vue'
import RolesGrid from '~/components/users/RolesGrid.vue'
import UserDetailSheet from '~/components/users/UserDetailSheet.vue'
import UsersTable from '~/components/users/UsersTable.vue'
import { useOwners } from '~/composables/useOwners'
import { useRoles } from '~/composables/useRoles'

definePageMeta({
  layout: 'default',
})

const { roles } = useRoles()
const { owners } = useOwners()

// Sheet state
const userSheetOpen = ref(false)
const editingUserId = ref<string | undefined>(undefined)

const roleSheetOpen = ref(false)
const editingRoleId = ref<RoleId | undefined>(undefined)

// Owner tab state (PRD 5.4 — Owners page retired, roster moved here)
const ownerOnboardingOpen = ref(false)
const ownerSheetOpen = ref(false)
const selectedOwnerId = ref<string | undefined>(undefined)

function openAddUser() {
  editingUserId.value = undefined
  userSheetOpen.value = true
}

function openEditUser(user: User) {
  editingUserId.value = user.id
  userSheetOpen.value = true
}

function openEditRole(role: Role) {
  editingRoleId.value = role.id
  roleSheetOpen.value = true
}

function openAddOwner() {
  ownerOnboardingOpen.value = true
}

function onOwnerCreated(ownerId: string) {
  selectedOwnerId.value = ownerId
  ownerSheetOpen.value = true
}

function onSelectOwner(owner: Owner) {
  selectedOwnerId.value = owner.id
  ownerSheetOpen.value = true
}
</script>

<template>
  <ClientOnly>
    <div class="space-y-6 p-6">
      <!-- Header -->
      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <h1 class="text-2xl font-bold tracking-tight">
            Users
          </h1>
          <p class="text-sm text-muted-foreground">
            Manage your team — create users and owners, assign roles and listings.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button>
              <Icon name="lucide:plus" class="mr-2 size-4" />
              Create
              <Icon name="lucide:chevron-down" class="ml-1 size-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="openAddUser">
              <Icon name="lucide:user-plus" class="mr-2 size-4" />
              User
            </DropdownMenuItem>
            <DropdownMenuItem @click="openAddOwner">
              <Icon name="lucide:building-2" class="mr-2 size-4" />
              Owner
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <!-- Tabs -->
      <Tabs default-value="users" class="space-y-4">
        <TabsList>
          <TabsTrigger value="users">
            <Icon name="lucide:users-round" class="mr-2 size-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="owners">
            <Icon name="lucide:building-2" class="mr-2 size-4" />
            Owners
            <Badge variant="secondary" class="ml-2">
              {{ owners.length }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Icon name="lucide:shield-check" class="mr-2 size-4" />
            Roles
            <Badge variant="secondary" class="ml-2">
              {{ roles.length }}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" class="space-y-4">
          <UsersTable @edit="openEditUser" />
        </TabsContent>

        <!-- PRD 5.4 — owner roster + statements + documents live here -->
        <TabsContent value="owners" class="space-y-3">
          <Tabs default-value="roster" class="space-y-3">
            <TabsList>
              <TabsTrigger value="roster">
                Owners
              </TabsTrigger>
              <TabsTrigger value="statements">
                Statements
              </TabsTrigger>
              <TabsTrigger value="documents">
                Documents
              </TabsTrigger>
            </TabsList>
            <TabsContent value="roster">
              <OwnersTable @select-owner="onSelectOwner" />
            </TabsContent>
            <TabsContent value="statements">
              <OwnerStatementsPanel />
            </TabsContent>
            <TabsContent value="documents">
              <OwnerDocumentsPanel />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="roles">
          <RolesGrid @edit="openEditRole" />
        </TabsContent>
      </Tabs>
    </div>

    <!-- Sheets -->
    <UserDetailSheet
      v-model:open="userSheetOpen"
      :user-id="editingUserId"
    />
    <RoleDetailSheet
      v-model:open="roleSheetOpen"
      :role-id="editingRoleId"
    />
    <OwnerOnboardingDialog
      v-model="ownerOnboardingOpen"
      @created="onOwnerCreated"
    />
    <OwnerDetailSheet
      v-model:open="ownerSheetOpen"
      :owner-id="selectedOwnerId"
    />

    <template #fallback>
      <div class="space-y-6 p-6">
        <Skeleton class="h-9 w-48" />
        <Skeleton class="h-4 w-72" />
        <Skeleton class="h-24 w-full" />
        <Skeleton class="h-64 w-full" />
      </div>
    </template>
  </ClientOnly>
</template>
