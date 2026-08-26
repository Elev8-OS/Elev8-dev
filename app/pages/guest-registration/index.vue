<script setup lang="ts">
import type { GuestRegistration } from '~/components/guest-registration/data/guest-registration'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { providerLabels, statusLabels } from '~/components/guest-registration/data/guest-registration'
import GuestRegistrationDetailDialog from '~/components/guest-registration/GuestRegistrationDetailDialog.vue'
import GuestRegistrationSubmitDialog from '~/components/guest-registration/GuestRegistrationSubmitDialog.vue'
import GuestRegistrationTable from '~/components/guest-registration/GuestRegistrationTable.vue'

const {
  filters,
  filteredRegistrations,
  stats,
  registrations,
  syncAllRegistrations,
  voidRegistration,
  checkOverdueRegistrations,
} = useGuestRegistration()

onMounted(() => {
  syncAllRegistrations()
  checkOverdueRegistrations()
})

// --- Dialog targets ---
const detailTarget = ref<GuestRegistration | null>(null)
const submitTarget = ref<GuestRegistration | null>(null)

const detailOpen = computed({
  get: () => detailTarget.value !== null,
  set: (val: boolean) => {
    if (!val)
      detailTarget.value = null
  },
})
const submitOpen = computed({
  get: () => submitTarget.value !== null,
  set: (val: boolean) => {
    if (!val)
      submitTarget.value = null
  },
})

const providerOptions = computed(() => [
  { label: 'All providers', value: 'all' },
  ...Object.entries(providerLabels).map(([value, label]) => ({ value, label })),
])

const statusOptions = computed(() => [
  { label: 'All statuses', value: 'all' },
  ...Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
])

const hasActiveFilters = computed(() =>
  filters.value.search
  || filters.value.provider !== 'all'
  || filters.value.status !== 'all',
)

function clearAllFilters() {
  filters.value.search = ''
  filters.value.provider = 'all'
  filters.value.status = 'all'
}

function handleSubmit(reg: GuestRegistration) {
  // Close the detail dialog before opening the submit dialog so their
  // stacked overlays don't block the submit dialog's clicks.
  detailTarget.value = null
  submitTarget.value = reg
}

function handleSubmitted(reg: GuestRegistration) {
  // Re-open the detail dialog with the freshly-updated registration record
  // (status now "submitted") after the submit dialog closes itself.
  const updated = registrations.value.find(r => r.id === reg.id) ?? reg
  submitTarget.value = null
  detailTarget.value = updated
}

function handleCloseSubmit() {
  submitTarget.value = null
}

function handleCloseDetails() {
  detailTarget.value = null
}

async function handleVoid(reg: GuestRegistration) {
  voidRegistration(reg.id)
  toast.info(`Registration for ${reg.guestName} voided.`)
}

function handleDetails(reg: GuestRegistration) {
  detailTarget.value = reg
}
</script>

<template>
  <div class="space-y-6 p-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Guest Registration
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ stats.pending }} pending · {{ stats.reported }} reported · {{ stats.failed }} failed
        </p>
      </div>
      <Button class="gap-2" @click="syncAllRegistrations()">
        <Icon name="lucide:refresh-cw" class="size-4" />
        Sync with reservations
      </Button>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader class="pb-2">
          <CardDescription>Pending</CardDescription>
          <CardTitle class="text-2xl">
            {{ stats.pending }}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardDescription>Incomplete</CardDescription>
          <CardTitle class="text-2xl">
            {{ stats.incomplete }}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardDescription>Reported</CardDescription>
          <CardTitle class="text-2xl">
            {{ stats.reported }}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardDescription>Failed</CardDescription>
          <CardTitle class="text-2xl">
            {{ stats.failed }}
            <span v-if="stats.failed" class="text-sm font-normal text-destructive">
              retry needed
            </span>
          </CardTitle>
        </CardHeader>
      </Card>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <!-- Search -->
      <div class="relative min-w-[200px] max-w-xs flex-1">
        <Icon name="lucide:search" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="filters.search" placeholder="Search guest, listing, passport..." class="pl-9" />
      </div>

      <!-- Provider -->
      <Select v-model="filters.provider">
        <SelectTrigger class="w-[190px]">
          <SelectValue placeholder="Provider" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="opt in providerOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <!-- Status -->
      <Select v-model="filters.status">
        <SelectTrigger class="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <!-- Clear all -->
      <Button v-if="hasActiveFilters" variant="ghost" class="h-9 text-xs" @click="clearAllFilters">
        Clear all
      </Button>
    </div>

    <GuestRegistrationTable
      :registrations="filteredRegistrations"
      @submit="handleSubmit"
      @details="handleDetails"
      @void="handleVoid"
    />

    <GuestRegistrationSubmitDialog
      v-model:open="submitOpen"
      :registration="submitTarget"
      @submitted="handleSubmitted"
      @close="handleCloseSubmit"
    />
    <GuestRegistrationDetailDialog
      v-model:open="detailOpen"
      :registration="detailTarget"
      @submit="handleSubmit"
      @close="handleCloseDetails"
    />
  </div>
</template>
