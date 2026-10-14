<script setup lang="ts">
import type { CleaningStepTemplate, CleaningTemplateType } from '~/components/cleaning/data/cleaning-step-templates'
import type { PropertyPickerOption } from '~/components/shared/PropertyPicker.vue'
import { toast } from 'vue-sonner'
import { CLEANING_SOURCE_ICONS, CLEANING_SOURCE_LABELS } from '~/components/cleaning/data/cleaning-jobs'
import { CLEANING_TEMPLATE_TYPES, resolveListingChecklist } from '~/components/cleaning/data/cleaning-step-templates'
import { listings } from '~/components/listings/data/listings'
import PropertyPicker from '~/components/shared/PropertyPicker.vue'
import { useCleaningSteps } from '~/composables/useCleaningSteps'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'

/**
 * Settings > Cleaning, "Assign to listings": one cleaning type on many
 * listings at once, as a listing override (`useCleaningSteps().setListingChecklist`).
 * Before saving it lists what each picked listing uses now, so a replaced
 * override or custom checklist is never a surprise.
 */
const props = defineProps<{ template: CleaningStepTemplate | null }>()
const open = defineModel<boolean>('open', { default: false })

const { library } = useCleaningStepTemplates()
const { setListingChecklist } = useCleaningSteps()

const type = ref<CleaningTemplateType>('check_out')
const listingIds = ref<string[]>([])

watch(open, (isOpen) => {
  if (!isOpen || !props.template)
    return
  type.value = 'check_out'
  listingIds.value = []
}, { immediate: true })

const options = computed<PropertyPickerOption[]>(() =>
  listings.value.map(l => ({ id: l.id, name: l.name, city: l.location, region: '' })),
)

/** Each picked listing and what it uses for the type today. */
const changes = computed(() => listingIds.value
  .map(id => listings.value.find(l => l.id === id))
  .filter((l): l is NonNullable<typeof l> => Boolean(l))
  .map((l) => {
    const current = resolveListingChecklist(l.maintenance, type.value, library.value)
    return {
      id: l.id,
      name: l.name,
      current: current ? current.name : 'No checklist',
      origin: current?.origin ?? null,
      unchanged: current?.origin === 'template' && current.template?.id === props.template?.id,
    }
  }))
const changeCount = computed(() => changes.value.filter(c => !c.unchanged).length)
const replacedCustom = computed(() => changes.value.filter(c => c.origin === 'custom').length)

function apply() {
  if (!props.template || !changeCount.value)
    return
  const count = setListingChecklist(listingIds.value, type.value, props.template.id)
  toast.success(`${props.template.name} is now the ${CLEANING_SOURCE_LABELS[type.value].toLowerCase()} checklist on ${count} ${count === 1 ? 'listing' : 'listings'}`)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Assign {{ template?.name }} to listings</DialogTitle>
        <DialogDescription>
          The picked listings use it for one cleaning type instead of the company default. New cleanings pick it up; existing ones keep their checklist.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <div class="grid gap-1.5">
          <Label>Cleaning type</Label>
          <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cleaning type">
            <div
              v-for="t in CLEANING_TEMPLATE_TYPES"
              :key="t"
              role="radio"
              :aria-checked="type === t"
              tabindex="0"
              class="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors"
              :class="type === t ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'"
              :data-testid="`assign-type-${t}`"
              @click="type = t"
              @keydown.enter.prevent="type = t"
              @keydown.space.prevent="type = t"
            >
              <Icon :name="CLEANING_SOURCE_ICONS[t]" class="size-3.5 shrink-0 text-muted-foreground" />
              {{ CLEANING_SOURCE_LABELS[t] }}
            </div>
          </div>
        </div>

        <div class="grid gap-1.5">
          <Label>Listings</Label>
          <PropertyPicker v-model="listingIds" :options="options" />
        </div>

        <div v-if="changes.length" class="flex max-h-56 flex-col divide-y overflow-y-auto rounded-lg border" data-testid="assign-preview">
          <div v-for="c in changes" :key="c.id" class="flex items-center justify-between gap-2 px-3 py-2 text-xs">
            <span class="truncate font-medium">{{ c.name }}</span>
            <span v-if="c.unchanged" class="shrink-0 text-muted-foreground">Already uses it</span>
            <span v-else class="flex shrink-0 items-center gap-1 text-muted-foreground">
              {{ c.current }}
              <Icon name="lucide:arrow-right" class="size-3" />
              <span class="text-foreground">{{ template?.name }}</span>
            </span>
          </div>
        </div>
        <p v-if="replacedCustom" class="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-200" data-testid="assign-replaces-custom">
          <Icon name="lucide:triangle-alert" class="mt-0.5 size-3 shrink-0" />
          {{ replacedCustom }} {{ replacedCustom === 1 ? 'listing uses' : 'listings use' }} custom steps for this type. The steps are kept, just not used for it.
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="!changeCount" data-testid="assign-apply" @click="apply">
          {{ changeCount ? `Assign to ${changeCount} ${changeCount === 1 ? 'listing' : 'listings'}` : 'Assign' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
