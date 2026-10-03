<script setup lang="ts">
import type { ListingDetailField, ListingDetailGroup } from '~/components/listings/data/listing-details'
import type { Listing } from '~/components/listings/data/listings'
import { detailGroupProgress } from '~/components/listings/data/listing-details'
import SetupSelectBox from '~/components/listings/setup/SetupSelectBox.vue'

/**
 * Field groups as accordion cards (Listing Setup > Listing Details and SOPs).
 * Each field reads and writes the listing through its own definition; the
 * `extra` slot adds content under a group's fields (e.g. custom SOPs).
 */
const props = defineProps<{
  listing: Listing
  groups: ListingDetailGroup[]
  /** `data-testid` prefix for each card, e.g. `setup-details` → `setup-details-booking`. */
  testidPrefix: string
  /** Fields a group's `extra` slot adds, so the header count includes them. */
  extraCounts?: Record<string, number>
  /** In select mode: field keys that can be ticked (bulk copy / delete). */
  selectable?: string[]
  /** Select mode: ticks on items and a select-all tick on each group header. */
  selecting?: boolean
  /** Selectable ids the `extra` slot shows per group (e.g. custom SOPs), so the group's select-all covers them. */
  extraSelectable?: Record<string, string[]>
}>()
const emit = defineEmits<{ update: [listing: Listing], configure: [key: string, label: string] }>()
/** Selected field keys, when `selectable` is set. */
const selected = defineModel<string[]>('selected', { default: () => [] })
function toggleSelected(key: string) {
  selected.value = selected.value.includes(key) ? selected.value.filter(k => k !== key) : [...selected.value, key]
}
/** Everything selectable in a group: its ticked-able fields plus its extra items. */
function groupSelectable(group: ListingDetailGroup) {
  return [
    ...group.fields.map(f => f.key).filter(k => props.selectable?.includes(k)),
    ...(props.extraSelectable?.[group.key] ?? []),
  ]
}
function groupState(group: ListingDetailGroup) {
  const ids = groupSelectable(group)
  const picked = ids.filter(id => selected.value.includes(id)).length
  return { ids, all: ids.length > 0 && picked === ids.length, some: picked > 0 && picked < ids.length }
}
function toggleGroup(group: ListingDetailGroup) {
  const { ids, all } = groupState(group)
  selected.value = all
    ? selected.value.filter(id => !ids.includes(id))
    : [...selected.value, ...ids.filter(id => !selected.value.includes(id))]
}
function hasConfig(key: string) { return !!props.listing.resources.fieldConfig?.[key] }

function groupComplete(group: ListingDetailGroup) {
  const { done, total } = detailGroupProgress(props.listing, group)
  return total > 0 && done === total
}
function fieldCount(group: ListingDetailGroup) {
  return group.fields.length + (props.extraCounts?.[group.key] ?? 0)
}
// Unfinished cards start open, finished ones collapsed. Set once, so a card
// does not snap shut the moment its last field is filled in.
const openGroups = ref(props.groups.filter(g => !groupComplete(g)).map(g => g.key))

function write(field: ListingDetailField, value: unknown) {
  emit('update', field.write(props.listing, String(value)))
}
</script>

<template>
  <Accordion v-model="openGroups" type="multiple" class="flex flex-col gap-3">
    <AccordionItem
      v-for="group in groups"
      :key="group.key"
      :value="group.key"
      class="rounded-lg border px-4 last:border-b"
      :data-testid="`${testidPrefix}-${group.key}`"
    >
      <div class="flex items-center gap-3">
        <!-- Outside the trigger: a tick inside it would be a control in a button. -->
        <SetupSelectBox
          v-if="selecting"
          :checked="groupState(group).all"
          :indeterminate="groupState(group).some"
          :label="`Select all in ${group.label}`"
          :class="{ 'pointer-events-none opacity-40': !groupState(group).ids.length }"
          @toggle="toggleGroup(group)"
        />
        <div class="min-w-0 flex-1">
          <AccordionTrigger class="items-center hover:no-underline">
            <span class="flex flex-1 items-center gap-3">
              <span v-if="group.icon" class="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/50">
                <Icon :name="group.icon" class="size-4 text-muted-foreground" />
              </span>
              <span class="flex flex-col gap-0.5">
                <span class="flex items-center gap-2">
                  {{ group.label }}
                  <Icon v-if="groupComplete(group)" name="lucide:circle-check" class="size-4 text-green-600 dark:text-green-400" aria-label="Complete" />
                </span>
                <span class="text-xs font-normal text-muted-foreground">{{ fieldCount(group) }} {{ fieldCount(group) === 1 ? 'field' : 'fields' }}</span>
              </span>
            </span>
          </AccordionTrigger>
        </div>
      </div>
      <AccordionContent class="flex flex-col gap-4 px-0.5">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div
            v-for="field in group.fields"
            :key="field.key"
            class="flex flex-col gap-1.5"
            :class="{ 'sm:col-span-2': ['textarea', 'time-range'].includes(field.input) || field.label.length > 40 }"
          >
            <div class="flex items-start gap-1.5">
              <SetupSelectBox
                v-if="selecting && selectable?.includes(field.key)"
                class="mt-0.5 mr-1"
                :checked="selected.includes(field.key)"
                :label="`Select ${field.label}`"
                @toggle="toggleSelected(field.key)"
              />
              <Label :for="`setup-${field.key}`" class="leading-snug">{{ field.label }}</Label>
              <button
                class="relative mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                :aria-label="`${field.label} AI settings`"
                @click="emit('configure', field.key, field.label)"
              >
                <Icon name="lucide:pencil" class="size-3" />
                <span v-if="hasConfig(field.key)" class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
              </button>
            </div>

            <Select
              v-if="field.input === 'select'"
              :model-value="field.read(listing) || undefined"
              @update:model-value="(v) => write(field, v)"
            >
              <SelectTrigger :id="`setup-${field.key}`" class="w-full">
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="option in field.options" :key="option" :value="option">
                  {{ option }}
                </SelectItem>
              </SelectContent>
            </Select>

            <div v-else-if="field.input === 'time-range'" class="flex items-center gap-2">
              <Input
                :id="`setup-${field.key}`"
                type="time"
                class="w-36"
                :model-value="field.read(listing)"
                @update:model-value="(v) => write(field, v)"
              />
              <span class="text-sm text-muted-foreground">to</span>
              <Input
                type="time"
                class="w-36"
                :aria-label="`${field.label} until`"
                :model-value="field.readEnd?.(listing) ?? ''"
                @update:model-value="(v) => field.writeEnd && emit('update', field.writeEnd(listing, String(v)))"
              />
            </div>

            <Textarea
              v-else-if="field.input === 'textarea'"
              :id="`setup-${field.key}`"
              rows="3"
              :placeholder="field.placeholder"
              :model-value="field.read(listing)"
              @update:model-value="(v) => write(field, v)"
            />

            <Input
              v-else
              :id="`setup-${field.key}`"
              :type="field.input"
              :min="field.input === 'number' ? 0 : undefined"
              :placeholder="field.placeholder"
              :model-value="field.read(listing)"
              @update:model-value="(v) => write(field, v)"
            />
          </div>
        </div>

        <slot name="extra" :group="group" />
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</template>
