<script setup lang="ts">
import type { FieldConfig, Listing, ReservationStage } from '~/components/listings/data/listings'
import { toast } from 'vue-sonner'
import { getUnits, listings, RESERVATION_STAGES } from '~/components/listings/data/listings'

const props = defineProps<{
  open: boolean
  fieldKey: string
  fieldLabel: string
  listing: Listing
}>()
const emit = defineEmits<{ 'update:open': [val: boolean], 'update': [listing: Listing] }>()

const stages = RESERVATION_STAGES

const currentConfig = computed<FieldConfig>(() =>
  props.listing.resources.fieldConfig?.[props.fieldKey] ?? { stages: ['future', 'inquiry_past', 'current'] },
)

const localStages = ref<ReservationStage[]>([...currentConfig.value.stages])

watch(() => props.open, (val) => {
  if (val)
    localStages.value = [...currentConfig.value.stages]
})

function toggleStage(stage: ReservationStage) {
  localStages.value = localStages.value.includes(stage)
    ? localStages.value.filter(s => s !== stage)
    : [...localStages.value, stage]
}

const showCopyDialog = ref(false)
const copySearch = ref('')
const otherListings = computed(() => listings.value.filter(l => l.id !== props.listing.id))
const filteredCopyListings = computed(() => {
  if (!copySearch.value)
    return otherListings.value
  return otherListings.value.filter(l => l.name.toLowerCase().includes(copySearch.value.toLowerCase()))
})

function copyToProperty(targetId: string) {
  const target = listings.value.find(l => l.id === targetId)
  if (!target)
    return
  const updatedConfig = { ...(target.resources.fieldConfig ?? {}), [props.fieldKey]: { stages: [...localStages.value] } }
  listings.value = listings.value.map(l => l.id === targetId ? { ...l, resources: { ...l.resources, fieldConfig: updatedConfig } } : l)
  toast.success(`Copied to ${target.name}`)
  showCopyDialog.value = false
  copySearch.value = ''
}

function save() {
  const updatedConfig = { ...(props.listing.resources.fieldConfig ?? {}), [props.fieldKey]: { stages: localStages.value } }
  emit('update', { ...props.listing, resources: { ...props.listing.resources, fieldConfig: updatedConfig } })
  emit('update:open', false)
}

const unitCount = computed(() => getUnits(props.listing).length)
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Additional Information</DialogTitle>
        <DialogDescription>Configure visibility and management options</DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-5 py-2">
        <!-- Property Type -->
        <div class="flex flex-col gap-1.5">
          <div class="text-sm font-medium">
            Property Type
          </div>
          <p class="text-sm text-muted-foreground">
            <template v-if="unitCount > 0">
              The property has {{ unitCount }} unit{{ unitCount > 1 ? 's' : '' }}.
            </template>
            <template v-else>
              Single unit property.
            </template>
          </p>
        </div>

        <Separator />

        <!-- Reservation Stages -->
        <div class="flex flex-col gap-2">
          <div class="text-sm font-medium">
            Reservation Stages
          </div>
          <p class="text-xs text-muted-foreground">
            Select which reservation stages should have access to this information. Deselected stages will not see this information.
          </p>
          <div class="flex flex-wrap gap-2 mt-1">
            <button
              v-for="stage in stages"
              :key="stage.value"
              class="rounded-full border px-3 py-1 text-xs transition-colors"
              :class="localStages.includes(stage.value) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'"
              @click="toggleStage(stage.value)"
            >
              {{ stage.label }}
            </button>
          </div>
        </div>

        <Separator />

        <!-- Management Options -->
        <div class="flex flex-col gap-2">
          <div class="text-sm font-medium">
            Management Options
          </div>
          <Button variant="outline" size="sm" class="w-fit gap-1.5" @click="showCopyDialog = true">
            <Icon name="lucide:copy" class="size-3.5" />
            Copy to Other Properties
          </Button>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button @click="save">
          Save Changes
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Copy to properties dialog -->
  <Dialog v-model:open="showCopyDialog">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>Copy to Properties</DialogTitle>
      </DialogHeader>
      <div class="relative">
        <Icon name="lucide:search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input v-model="copySearch" placeholder="Search listings..." class="pl-8" />
      </div>
      <ScrollArea class="max-h-60">
        <div class="flex flex-col gap-1">
          <div
            v-for="l in filteredCopyListings" :key="l.id"
            class="flex items-center gap-3 rounded-md px-2 py-2 cursor-pointer hover:bg-accent"
            @click="copyToProperty(l.id)"
          >
            <div class="size-8 rounded overflow-hidden bg-muted shrink-0">
              <img :src="l.photos[0]" class="size-full object-cover">
            </div>
            <span class="text-sm truncate">{{ l.name }}</span>
          </div>
        </div>
      </ScrollArea>
    </DialogContent>
  </Dialog>
</template>
