<script setup lang="ts">
import type { CleaningTemplateType } from '~/components/cleaning/data/cleaning-step-templates'
import type { ListingCleaningConfig } from '~/components/reservations/data/cleaning-schedule'
import type { PropertyPickerOption } from '~/components/shared/PropertyPicker.vue'
import { toast } from 'vue-sonner'
import CleaningScheduleFields from '~/components/cleaning/CleaningScheduleFields.vue'
import { cleanerOptions, CLEANING_SOURCE_ICONS, CLEANING_SOURCE_LABELS } from '~/components/cleaning/data/cleaning-jobs'
import { CLEANING_TEMPLATE_TYPES } from '~/components/cleaning/data/cleaning-step-templates'
import { countCleaningSteps } from '~/components/cleaning/data/cleaning-steps'
import { listings } from '~/components/listings/data/listings'
import PropertyPicker from '~/components/shared/PropertyPicker.vue'
import { useCleaningScheduleDefault } from '~/composables/useCleaningScheduleDefault'
import { useCleaningSteps } from '~/composables/useCleaningSteps'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'

/**
 * The onboarding checklist's "Set up cleaning": three short steps over the
 * company defaults, which are ALREADY active (a new tenant's listings can be
 * cleaned from day one). Nothing here is required; "Skip, use the defaults"
 * finishes the item as it is.
 * 1. Checklists: what the tenant manages picks the check-out default
 *    (villa or studio); "a mix" also overrides check-out on the picked
 *    apartments. The four type defaults stay editable.
 * 2. The company cleaning schedule (`CleaningScheduleFields`, also in Settings > Cleaning).
 * 3. Housekeeping: the default cleaners for that schedule.
 * Each step writes when the tenant moves on, so leaving halfway keeps what was done.
 */
const emit = defineEmits<{ done: [] }>()

const { sortedTemplates, getTemplate, typeDefaults, setTypeDefault } = useCleaningStepTemplates()
const { companyDefault, setCompanyDefault } = useCleaningScheduleDefault()
const { setListingChecklist } = useCleaningSteps()

const STEPS = [
  { id: 'checklists', title: 'Checklists' },
  { id: 'schedule', title: 'Schedule' },
  { id: 'team', title: 'Housekeeping' },
] as const
const stepIndex = ref(0)

// --- 1. Checklists ---------------------------------------------------------------
type PropertyMix = 'villas' | 'apartments' | 'mixed'
const VILLA_TEMPLATE = 'cst-villa'
const STUDIO_TEMPLATE = 'cst-studio'
const PROPERTY_MIX_OPTIONS: { id: PropertyMix, title: string, hint: string, icon: string }[] = [
  { id: 'villas', title: 'Private villas', hint: 'Turnover clean for a whole house', icon: 'lucide:house' },
  { id: 'apartments', title: 'Apartments / studios', hint: 'Short turnover for a smaller unit', icon: 'lucide:building-2' },
  { id: 'mixed', title: 'A mix of both', hint: 'Pick which listings are apartments', icon: 'lucide:layers' },
]
const propertyMix = ref<PropertyMix>(typeDefaults.value.check_out === STUDIO_TEMPLATE ? 'apartments' : 'villas')
const apartmentIds = ref<string[]>([])
const listingOptions = computed<PropertyPickerOption[]>(() =>
  listings.value.map(l => ({ id: l.id, name: l.name, city: l.location, region: '' })),
)

// The answer sets the check-out default, when the starter template still exists.
watch(propertyMix, (mix) => {
  const id = mix === 'apartments' ? STUDIO_TEMPLATE : VILLA_TEMPLATE
  if (getTemplate(id))
    setTypeDefault('check_out', id)
})

const defaultRows = computed(() => CLEANING_TEMPLATE_TYPES.map((type) => {
  const template = getTemplate(typeDefaults.value[type] ?? '')
  return { type, label: CLEANING_SOURCE_LABELS[type], icon: CLEANING_SOURCE_ICONS[type], value: template?.id ?? '', stepCount: template ? countCleaningSteps(template.sections) : 0 }
}))

function saveChecklists() {
  if (propertyMix.value === 'mixed' && apartmentIds.value.length && getTemplate(STUDIO_TEMPLATE))
    setListingChecklist(apartmentIds.value, 'check_out', STUDIO_TEMPLATE)
}

// --- 2. Cleaning schedule ------------------------------------------------------
const schedule = ref<ListingCleaningConfig>(JSON.parse(JSON.stringify(companyDefault.value)))

// --- 3. Housekeeping ---------------------------------------------------------------
const cleanerIds = ref<string[]>([...(companyDefault.value.assigneeIds ?? [])])
function toggleCleaner(id: string) {
  cleanerIds.value = cleanerIds.value.includes(id) ? cleanerIds.value.filter(c => c !== id) : [...cleanerIds.value, id]
}

function saveSchedule() {
  setCompanyDefault({
    ...schedule.value,
    assigneeIds: cleanerIds.value.length ? [...cleanerIds.value] : undefined,
    assigneeId: cleanerIds.value[0],
  })
}

// --- Navigation ----------------------------------------------------------------------
function next() {
  if (stepIndex.value === 0)
    saveChecklists()
  if (stepIndex.value >= 1)
    saveSchedule()
  if (stepIndex.value < STEPS.length - 1) {
    stepIndex.value++
    return
  }
  toast.success('Cleaning is set up')
  emit('done')
}

function skip() {
  toast.success('Using the default checklists and schedule')
  emit('done')
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-2xl flex-col gap-6">
    <div class="flex flex-col gap-1">
      <h2 class="text-2xl font-bold tracking-tight">
        Set up cleaning
      </h2>
      <p class="text-sm text-muted-foreground">
        Cleaning already works with our starter checklists. Adjust them to how you run housekeeping, or keep the defaults.
      </p>
    </div>

    <ol class="flex items-center gap-2" aria-label="Progress">
      <li v-for="(step, i) in STEPS" :key="step.id" class="flex flex-1 items-center gap-2">
        <span
          class="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium"
          :class="i < stepIndex ? 'bg-primary text-primary-foreground' : i === stepIndex ? 'border-2 border-primary text-primary' : 'border text-muted-foreground'"
          :aria-current="i === stepIndex ? 'step' : undefined"
        >
          <Icon v-if="i < stepIndex" name="lucide:check" class="size-3.5" />
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span class="truncate text-xs" :class="i === stepIndex ? 'font-medium' : 'text-muted-foreground'">{{ step.title }}</span>
        <span v-if="i < STEPS.length - 1" class="h-px flex-1 bg-border" />
      </li>
    </ol>

    <Card class="gap-5 p-5" data-testid="cleaning-setup-step" :data-step="STEPS[stepIndex]!.id">
      <!-- 1. Checklists -->
      <template v-if="stepIndex === 0">
        <div class="grid gap-2">
          <Label>What do you mostly manage?</Label>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="What do you mostly manage?">
            <div
              v-for="option in PROPERTY_MIX_OPTIONS"
              :key="option.id"
              role="radio"
              :aria-checked="propertyMix === option.id"
              tabindex="0"
              class="flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors"
              :class="propertyMix === option.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'"
              :data-testid="`setup-mix-${option.id}`"
              @click="propertyMix = option.id"
              @keydown.enter.prevent="propertyMix = option.id"
              @keydown.space.prevent="propertyMix = option.id"
            >
              <Icon :name="option.icon" class="size-4 text-muted-foreground" />
              <span class="text-sm font-medium">{{ option.title }}</span>
              <span class="text-xs text-muted-foreground">{{ option.hint }}</span>
            </div>
          </div>
        </div>

        <div v-if="propertyMix === 'mixed'" class="grid gap-1.5" data-testid="setup-apartments">
          <Label>Which listings are apartments?</Label>
          <PropertyPicker v-model="apartmentIds" :options="listingOptions" />
          <p class="text-xs text-muted-foreground">
            They use the studio checklist at check-out. The rest use the villa checklist.
          </p>
        </div>

        <div class="grid gap-2">
          <Label>Checklist per cleaning type</Label>
          <div class="flex flex-col divide-y rounded-lg border">
            <div v-for="row in defaultRows" :key="row.type" class="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center" :data-testid="`setup-default-${row.type}`">
              <span class="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
                <Icon :name="row.icon" class="size-3.5 shrink-0 text-muted-foreground" />
                {{ row.label }}
              </span>
              <Select :model-value="row.value" @update:model-value="value => setTypeDefault(row.type as CleaningTemplateType, String(value))">
                <SelectTrigger class="h-8 w-full text-xs sm:w-48" :aria-label="`Checklist for ${row.label.toLowerCase()}`">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="t in sortedTemplates" :key="t.id" :value="t.id">
                    {{ t.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <span class="shrink-0 text-xs text-muted-foreground sm:w-16 sm:text-right">{{ row.stepCount }} steps</span>
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            Want to change the steps themselves?
            <NuxtLink to="/settings/cleaning-templates" class="font-medium underline-offset-4 hover:underline">
              Edit templates
            </NuxtLink>
          </p>
        </div>
      </template>

      <!-- 2. Cleaning schedule -->
      <template v-else-if="stepIndex === 1">
        <CleaningScheduleFields v-model="schedule" />
        <p class="text-xs text-muted-foreground">
          Change it later in Settings > Cleaning. Each listing can override it on its Maintenance tab, and each booking can still be changed.
        </p>
      </template>

      <!-- 3. Housekeeping -->
      <template v-else>
        <div class="grid gap-2">
          <Label>Who cleans by default?</Label>
          <div class="flex flex-col divide-y rounded-lg border">
            <div
              v-for="cleaner in cleanerOptions"
              :key="cleaner.id"
              class="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40"
              :data-testid="`setup-cleaner-${cleaner.id}`"
              @click="toggleCleaner(cleaner.id)"
            >
              <div
                class="flex size-4 items-center justify-center rounded-[4px] border"
                :class="cleanerIds.includes(cleaner.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
              >
                <Icon v-if="cleanerIds.includes(cleaner.id)" name="lucide:check" class="size-3" />
              </div>
              {{ cleaner.name }}
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            Leave empty to assign cleanings by hand.
            <NuxtLink to="/users" class="font-medium underline-offset-4 hover:underline">
              Add a cleaner
            </NuxtLink>
          </p>
        </div>
        <div class="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
          <Icon name="lucide:smartphone" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p class="text-sm">
            Cleaners work through the checklist in the ELEV8 Go app. Share it with your team from
            <NuxtLink to="/users" class="font-medium underline-offset-4 hover:underline">
              Users
            </NuxtLink>.
          </p>
        </div>
      </template>
    </Card>

    <div class="flex flex-col-reverse items-stretch justify-between gap-2 sm:flex-row sm:items-center">
      <Button variant="ghost" data-testid="setup-skip" @click="skip">
        Skip, use the defaults
      </Button>
      <div class="flex gap-2">
        <Button v-if="stepIndex > 0" variant="outline" class="flex-1 sm:flex-none" @click="stepIndex--">
          Back
        </Button>
        <Button class="flex-1 sm:flex-none" data-testid="setup-next" @click="next">
          {{ stepIndex === STEPS.length - 1 ? 'Finish' : 'Continue' }}
        </Button>
      </div>
    </div>
  </div>
</template>
