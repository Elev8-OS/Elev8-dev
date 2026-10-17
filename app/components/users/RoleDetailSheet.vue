<!-- app/components/users/RoleDetailSheet.vue -->
<script setup lang="ts">
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '~/components/ui/sheet'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { toast } from 'vue-sonner'
import NotificationSettings from './NotificationSettings.vue'
import PermissionMatrix from './PermissionMatrix.vue'
import { useRoles } from '~/composables/useRoles'
import { useSchedule } from '~/composables/useSchedule'
import { useUsers } from '~/composables/useUsers'
import type { AlertType } from '~/components/notifications/data/alerts'
import type { Role, RoleId } from '~/components/users/data/roles'
import type { ModulePermissions, PermissionModule } from '~/components/users/data/permissions'

interface Props {
  open: boolean
  roleId?: RoleId
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [role: Role]
}>()

const { getRole, updateRole, resetRoleToDefaults } = useRoles()
const { users } = useUsers()
const { shifts, personDays, personShifts, rotations } = useSchedule()

const editingRole = computed(() => props.roleId ? getRole(props.roleId) : undefined)

// Working copy of role
const draft = ref<Role | null>(null)

watch(() => [props.open, props.roleId], () => {
  if (props.open && editingRole.value) {
    draft.value = JSON.parse(JSON.stringify(editingRole.value))
  }
}, { immediate: true })

/** People in this role, and how many of them have a schedule of their own (their own days, shifts or a rotation). */
const roleUsage = computed(() => {
  const members = users.value.filter(u => u.roleId === draft.value?.id && u.status === 'active')
  const own = members.filter(u => personDays.value[u.id] || personShifts.value[u.id]?.length || rotations.value[u.id])
  return { total: members.length, own: own.length }
})

/** The role's working hours as saved (not the draft): they are edited in Schedule, so this is only a summary. */
const hoursSummary = computed(() => {
  const wh = editingRole.value?.workingHours
  if (!wh)
    return ''
  const days = wh.days.length === 7 ? 'Every day' : wh.days.join(', ')
  const named = (wh.shiftIds ?? []).map(id => shifts.value.find(t => t.id === id)).filter(t => !!t)
  if (wh.scheduleType === 'flexible')
    return `${days}, flexible hours`
  return `${days}, ${named.length ? named.map(t => `${t.name} ${t.start} to ${t.end}`).join(' + ') : `${wh.startTime} to ${wh.endTime}`}`
})

function setPermissions(next: Record<PermissionModule, ModulePermissions>) {
  if (!draft.value) return
  draft.value.defaultPermissions = next
}

function setEnabledAlertTypes(next: AlertType[]) {
  if (!draft.value) return
  draft.value.notifications.enabledAlertTypes = next
}

function handleSave() {
  if (!draft.value) return
  updateRole(draft.value.id, {
    name: draft.value.name,
    description: draft.value.description,
    defaultPermissions: draft.value.defaultPermissions,
    notifications: draft.value.notifications,
  })
  toast.success(`Role ${draft.value.name} saved`)
  emit('saved', draft.value)
  emit('update:open', false)
}

function handleReset() {
  if (!draft.value) return
  const roleName = draft.value.name
  resetRoleToDefaults(draft.value.id)
  const fresh = getRole(draft.value.id)
  if (fresh) draft.value = JSON.parse(JSON.stringify(fresh))
  toast.info(`Role ${roleName} reset to defaults`)
}
</script>

<template>
  <Sheet v-if="draft" :open="open" @update:open="(v) => emit('update:open', v)">
    <SheetContent side="right" class="w-full sm:max-w-5xl p-0 flex flex-col">
      <SheetHeader class="px-6 pt-6 pb-4">
        <SheetTitle>{{ draft.name }}</SheetTitle>
        <SheetDescription>
          Edit role metadata, default permissions, and notification settings. Permissions and notifications are the defaults for new users. Working hours are set in Schedule and apply to everyone in the role straight away.
        </SheetDescription>
      </SheetHeader>

      <div class="flex-1 min-h-0 overflow-y-auto">
        <div class="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 px-6 pb-6">
          <!-- Left: role metadata -->
          <div class="space-y-5">
            <div class="space-y-1.5">
              <Label for="role-name">Role name</Label>
              <Input id="role-name" v-model="draft.name" />
            </div>

            <div class="space-y-1.5">
              <Label for="role-desc">Description</Label>
              <Textarea
                id="role-desc"
                v-model="draft.description"
                rows="4"
                class="resize-none"
              />
            </div>

            <div class="space-y-2">
              <Label>Working hours</Label>
              <div class="rounded-md border bg-muted/40 p-3 text-sm">
                <p class="font-medium">
                  {{ hoursSummary }}
                </p>
                <p class="mt-1 text-xs text-muted-foreground">
                  <template v-if="roleUsage.total">
                    {{ roleUsage.total }} active {{ roleUsage.total === 1 ? 'person has' : 'people have' }} this role<template v-if="roleUsage.own">, {{ roleUsage.own }} with a schedule of their own</template>.
                  </template>
                  <template v-else>
                    Nobody has this role yet.
                  </template>
                </p>
              </div>
              <Button as-child variant="outline" size="sm">
                <NuxtLink to="/schedule?tab=defaults">
                  <Icon name="lucide:calendar-cog" class="mr-2 size-4" />
                  Edit in Schedule
                </NuxtLink>
              </Button>
              <p class="text-xs text-muted-foreground">
                Working days and shifts are set in Schedule, together with days off and rotations.
              </p>
            </div>

            <Button variant="outline" class="w-full" @click="handleReset">
              <Icon name="lucide:rotate-ccw" class="mr-2 size-4" />
              Reset to defaults
            </Button>
          </div>

          <!-- Right: permission matrix (Dashboard / Mobile / Notifications) -->
          <PermissionMatrix
            :permissions="draft.defaultPermissions"
            @update:permissions="setPermissions"
          >
            <template #notifications>
              <NotificationSettings
                :model-value="{ enabledAlertTypes: draft.notifications.enabledAlertTypes }"
                @update:model-value="(next) => setEnabledAlertTypes(next.enabledAlertTypes as AlertType[])"
              />
            </template>
          </PermissionMatrix>
        </div>
      </div>

      <SheetFooter class="border-t px-6 py-4 flex-row justify-end gap-2">
        <Button variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button @click="handleSave">
          Save changes
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
