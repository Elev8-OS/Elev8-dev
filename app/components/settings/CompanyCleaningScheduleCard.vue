<script setup lang="ts">
import type { ListingCleaningConfig } from '~/components/reservations/data/cleaning-schedule'
import { toast } from 'vue-sonner'
import CleaningScheduleFields from '~/components/cleaning/CleaningScheduleFields.vue'
import { cleanerOptions } from '~/components/cleaning/data/cleaning-jobs'
import { listings } from '~/components/listings/data/listings'
import StaffMultiSelectDropdown from '~/components/shared/StaffMultiSelectDropdown.vue'
import { useCleaningScheduleDefault } from '~/composables/useCleaningScheduleDefault'

/**
 * Settings > Cleaning: the company cleaning schedule every listing follows
 * unless it sets its own (Maintenance tab), including how often an empty
 * listing is cleaned. Edits a draft; Save writes `setCompanyDefault`, which the
 * cleaning-routine plugin picks up at once.
 */
const { companyDefault, setCompanyDefault } = useCleaningScheduleDefault()

const draft = ref<ListingCleaningConfig>(JSON.parse(JSON.stringify(companyDefault.value)))
const cleanerIds = ref<string[]>([...(companyDefault.value.assigneeIds ?? [])])

function next(): ListingCleaningConfig {
  return {
    ...draft.value,
    assigneeIds: cleanerIds.value.length ? [...cleanerIds.value] : undefined,
    assigneeId: cleanerIds.value[0],
  }
}

// What Save would write when nothing changed, so Cancel and Save know when to wake up.
const saved = ref(JSON.stringify(next()))
const dirty = computed(() => JSON.stringify(next()) !== saved.value)

function reset() {
  draft.value = JSON.parse(JSON.stringify(companyDefault.value))
  cleanerIds.value = [...(companyDefault.value.assigneeIds ?? [])]
  saved.value = JSON.stringify(next())
}

/** Listings with a schedule of their own, which this does not reach. */
const ownScheduleCount = computed(() => listings.value.filter(l => l.maintenance?.defaultCleaningSchedule).length)

function save() {
  setCompanyDefault(next())
  reset()
  toast.success('Cleaning schedule saved')
}
</script>

<template>
  <Card class="gap-4 p-5" data-testid="company-cleaning-schedule">
    <div>
      <h3 class="text-base font-semibold">
        Cleaning schedule
      </h3>
      <p class="mt-0.5 text-xs text-muted-foreground">
        Every listing follows this unless it sets its own on its Maintenance tab.
        <template v-if="ownScheduleCount">
          {{ ownScheduleCount }} {{ ownScheduleCount === 1 ? 'listing has' : 'listings have' }} its own.
        </template>
      </p>
    </div>

    <CleaningScheduleFields v-model="draft" />

    <div class="grid gap-1.5">
      <Label>Default cleaners</Label>
      <StaffMultiSelectDropdown
        v-model="cleanerIds"
        :options="cleanerOptions"
        placeholder="Search and select default cleaners..."
        title="Default Cleaners"
      />
    </div>

    <div class="flex justify-end gap-2">
      <Button variant="outline" :disabled="!dirty" @click="reset">
        Cancel
      </Button>
      <Button :disabled="!dirty" data-testid="company-cleaning-schedule-save" @click="save">
        Save schedule
      </Button>
    </div>
  </Card>
</template>
