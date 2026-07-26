<!-- app/components/users/RoleDetailSheet.vue -->
<script setup lang="ts">
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '~/components/ui/sheet'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import { Input as TimeInput } from '~/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'vue-sonner'
import NotificationSettings from './NotificationSettings.vue'
import PermissionMatrix from './PermissionMatrix.vue'
import { useRoles } from '~/composables/useRoles'
import type { AlertType } from '~/components/notifications/data/alerts'
import type { Role, RoleId, WeekDay } from '~/components/users/data/roles'
import { WEEK_DAYS } from '~/components/users/data/roles'
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

const editingRole = computed(() => props.roleId ? getRole(props.roleId) : undefined)

// Working copy of role
const draft = ref<Role | null>(null)

watch(() => [props.open, props.roleId], () => {
  if (props.open && editingRole.value) {
    draft.value = JSON.parse(JSON.stringify(editingRole.value))
  }
}, { immediate: true })

function toggleDay(day: WeekDay) {
  if (!draft.value) return
  const set = new Set(draft.value.workingHours.days)
  if (set.has(day)) set.delete(day)
  else set.add(day)
  draft.value.workingHours.days = Array.from(set) as WeekDay[]
}

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
    workingHours: draft.value.workingHours,
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
          Edit role metadata, working hours, default permissions, and notification settings. Changes apply to new users assigned this role.
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
              <ToggleGroup
                :model-value="draft.workingHours.scheduleType"
                type="single"
                class="justify-start"
                @update:model-value="(v) => draft!.workingHours.scheduleType = (v as 'flexible' | 'fixed')"
              >
                <ToggleGroupItem value="flexible">
                  Flexible
                </ToggleGroupItem>
                <ToggleGroupItem value="fixed">
                  Fixed
                </ToggleGroupItem>
              </ToggleGroup>

              <div v-if="draft.workingHours.scheduleType === 'fixed'" class="grid grid-cols-2 gap-2">
                <div class="space-y-1">
                  <Label for="role-start" class="text-xs">Start</Label>
                  <TimeInput id="role-start" type="time" v-model="draft.workingHours.startTime" />
                </div>
                <div class="space-y-1">
                  <Label for="role-end" class="text-xs">End</Label>
                  <TimeInput id="role-end" type="time" v-model="draft.workingHours.endTime" />
                </div>
              </div>

              <div class="flex flex-wrap gap-1">
                <button
                  v-for="d in WEEK_DAYS"
                  :key="d"
                  type="button"
                  :class="cn(
                    'px-2.5 py-1 rounded-full border text-xs font-medium transition-colors',
                    draft.workingHours.days.includes(d)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background hover:bg-muted',
                  )"
                  @click="toggleDay(d)"
                >
                  {{ d.slice(0, 3) }}
                </button>
              </div>
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
