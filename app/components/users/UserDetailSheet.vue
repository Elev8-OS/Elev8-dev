<!-- app/components/users/UserDetailSheet.vue -->
<script setup lang="ts">
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '~/components/ui/sheet'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Switch } from '~/components/ui/switch'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Separator } from '~/components/ui/separator'
import { useUsers } from '~/composables/useUsers'
import { useRoles } from '~/composables/useRoles'
import { toast } from 'vue-sonner'
import UserPersonalInfoForm from './UserPersonalInfoForm.vue'
import UserAssignmentPicker from './UserAssignmentPicker.vue'
import TenantAssignmentPicker from './TenantAssignmentPicker.vue'
import SalaryDisplay from './SalaryDisplay.vue'
import type { User, PreferredLanguage } from '~/components/users/data/users'
import type { RoleId } from '~/components/users/data/roles'

interface Props {
  open: boolean
  userId?: string // undefined = create mode
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [user: User]
}>()

const { addUser, updateUser, getUser, findByEmail } = useUsers()
const { roles } = useRoles()

const isEdit = computed(() => !!props.userId)
const editingUser = computed(() => (props.userId ? getUser(props.userId) : undefined))

// Form state — shared shape across all sections (Personal Info / Compensation / Role & Listings)
const form = ref({
  name: '',
  phone: '+62',
  preferredLanguage: 'en' as PreferredLanguage,
  email: '',
  employeeNumber: '',
  monthlySalaryAmount: 0,
  workingDaysPerMonth: 0,
  hoursPerDay: 0,
  roleId: '' as RoleId | '',
  listingIds: [] as string[],
  assignedTenantIds: [] as string[],
  status: 'active' as 'active' | 'inactive',
})

const errors = ref<Record<string, string>>({})

// Reset form whenever the sheet opens or the userId changes
watch(
  () => [props.open, props.userId],
  () => {
    if (!props.open) return
    errors.value = {}
    if (editingUser.value) {
      form.value = {
        name: editingUser.value.name,
        phone: editingUser.value.phone || '+62',
        preferredLanguage: editingUser.value.preferredLanguage,
        email: editingUser.value.email,
        employeeNumber: editingUser.value.employeeNumber,
        monthlySalaryAmount: editingUser.value.monthlySalaryAmount,
        workingDaysPerMonth: editingUser.value.workingDaysPerMonth,
        hoursPerDay: editingUser.value.hoursPerDay,
        roleId: editingUser.value.roleId,
        listingIds: [...editingUser.value.listingIds],
        assignedTenantIds: [...(editingUser.value.assignedTenantIds ?? [])],
        status: editingUser.value.status,
      }
    }
    else {
      form.value = {
        name: '',
        phone: '+62',
        preferredLanguage: 'en',
        email: '',
        employeeNumber: '',
        monthlySalaryAmount: 0,
        workingDaysPerMonth: 0,
        hoursPerDay: 0,
        roleId: 'role-housekeeping',
        listingIds: [],
        assignedTenantIds: [],
        status: 'active',
      }
    }
  },
  { immediate: true },
)

function validate(): boolean {
  const e: Record<string, string> = {}
  if (!form.value.name.trim()) e.name = 'Name is required'
  if (!form.value.email.trim()) {
    e.email = 'Email is required'
  }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email.trim())) {
    e.email = 'Invalid email format'
  }
  else {
    const existing = findByEmail(form.value.email)
    if (existing && existing.id !== props.userId) {
      e.email = 'A user with this email already exists'
    }
  }
  if (!form.value.roleId) e.roleId = 'Role is required'
  errors.value = e
  return Object.keys(e).length === 0
}

const noListingsWarning = computed(
  () =>
    !!form.value.roleId
    && form.value.roleId !== 'role-admin'
    && form.value.roleId !== 'role-owner'
    && form.value.listingIds.length === 0,
)

function handleSave() {
  if (!validate()) return

  const payload = {
    name: form.value.name.trim(),
    phone: form.value.phone,
    preferredLanguage: form.value.preferredLanguage,
    email: form.value.email.trim(),
    employeeNumber: form.value.employeeNumber.trim(),
    monthlySalaryAmount: form.value.monthlySalaryAmount,
    workingDaysPerMonth: form.value.workingDaysPerMonth,
    hoursPerDay: form.value.hoursPerDay,
    roleId: form.value.roleId as RoleId,
    listingIds: form.value.listingIds,
    assignedTenantIds: form.value.roleId === 'role-guest-experience-manager' ? form.value.assignedTenantIds : [],
    status: form.value.status,
  }

  let saved: User
  if (editingUser.value) {
    updateUser(editingUser.value.id, payload)
    saved = { ...editingUser.value, ...payload }
    toast.success(`User ${saved.name} updated`)
  }
  else {
    saved = addUser(payload)
    toast.success(`User ${saved.name} added`)
  }
  emit('saved', saved)
  emit('update:open', false)
}
</script>

<template>
  <Sheet :open="open" @update:open="(v) => emit('update:open', v)">
    <SheetContent side="right" class="w-full sm:max-w-2xl p-0 flex flex-col">
      <SheetHeader class="px-6 pt-6 pb-4">
        <SheetTitle>{{ isEdit ? 'Edit user' : 'Add user' }}</SheetTitle>
        <SheetDescription>
          {{ isEdit ? 'Update user details, role, and listing assignments.' : 'Create a new team member with a role and listing assignments.' }}
        </SheetDescription>
      </SheetHeader>

      <div class="flex-1 min-h-0 overflow-y-auto px-6 space-y-6 pb-6">
        <!-- Personal Info -->
        <section class="space-y-3">
          <h3 class="text-sm font-medium">
            Personal Info
          </h3>
          <UserPersonalInfoForm
            v-model="form"
            :errors="{
              name: errors.name,
              email: errors.email,
            }"
          />
        </section>

        <Separator />

        <!-- Salary (display only) -->
        <section class="space-y-3">
          <h3 class="text-sm font-medium">
            Compensation
          </h3>
          <SalaryDisplay
            :amount="form.monthlySalaryAmount"
            :working-days-per-month="form.workingDaysPerMonth"
            :hours-per-day="form.hoursPerDay"
          />
        </section>

        <Separator />

        <!-- Role & Listings -->
        <section class="space-y-4">
          <h3 class="text-sm font-medium">
            Role &amp; Listings
          </h3>

          <div class="space-y-1.5">
            <Label for="user-role">
              Role <span class="text-destructive">*</span>
            </Label>
            <Select
              :model-value="form.roleId"
              @update:model-value="(v) => form.roleId = String(v) as RoleId"
            >
              <SelectTrigger id="user-role">
                <SelectValue placeholder="Select role..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="r in roles" :key="r.id" :value="r.id">
                  {{ r.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="errors.roleId" class="text-xs text-destructive">
              {{ errors.roleId }}
            </p>
          </div>

          <div class="space-y-1.5">
            <Label>Assign to Listings</Label>
            <UserAssignmentPicker v-model="form.listingIds" />
            <p class="text-xs text-muted-foreground">
              Leave empty for tenant-wide access (Admin/Owner).
            </p>
          </div>

          <div v-if="form.roleId === 'role-guest-experience-manager'" class="space-y-1.5">
            <Label>Assign to Tenants</Label>
            <TenantAssignmentPicker v-model="form.assignedTenantIds" />
            <p class="text-xs text-muted-foreground">
              A Guest Experience Manager (GRO) sees inbox messages and calls across all assigned tenants.
            </p>
          </div>

          <Alert v-if="noListingsWarning" variant="default" class="border-amber-500/50 bg-amber-500/10">
            <Icon name="lucide:triangle-alert" class="size-4 text-amber-600" />
            <AlertDescription class="text-amber-700 dark:text-amber-400">
              This user will have no listing access. They won't see any properties in their dashboard.
            </AlertDescription>
          </Alert>

          <div class="flex items-center justify-between rounded-lg border p-3">
            <div class="space-y-0.5">
              <Label for="user-active" class="text-sm">Active</Label>
              <p class="text-xs text-muted-foreground">
                Inactive users can't sign in or receive assignments.
              </p>
            </div>
            <Switch
              id="user-active"
              :model-value="form.status === 'active'"
              @update:model-value="(v) => form.status = v ? 'active' : 'inactive'"
            />
          </div>
        </section>
      </div>

      <SheetFooter class="border-t px-6 py-4 flex-row justify-end gap-2">
        <Button variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button :disabled="!form.name.trim() || !form.email.trim() || !form.roleId" @click="handleSave">
          {{ isEdit ? 'Save changes' : 'Add user' }}
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
