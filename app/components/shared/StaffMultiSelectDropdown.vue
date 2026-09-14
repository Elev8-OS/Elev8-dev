<script setup lang="ts">
import { computed, ref } from 'vue'
import BasePersonAvatar from '~/components/base/PersonAvatar.vue'
import { cleanerOptions as defaultCleanerOptions } from '~/components/cleaning/data/cleaning-jobs'
import Badge from '~/components/ui/badge/Badge.vue'
import Popover from '~/components/ui/popover/Popover.vue'
import PopoverContent from '~/components/ui/popover/PopoverContent.vue'
import PopoverTrigger from '~/components/ui/popover/PopoverTrigger.vue'
import ScrollArea from '~/components/ui/scroll-area/ScrollArea.vue'

export interface StaffOption {
  id: string
  name: string
  role?: string
  avatar?: string
  avatarUrl?: string
}

const props = withDefaults(defineProps<{
  modelValue?: string[]
  options?: StaffOption[]
  title?: string
  placeholder?: string
  emptyText?: string
  buttonClass?: string
  compact?: boolean
  showTags?: boolean
  disabled?: boolean
  popoverWidth?: string
  contentClass?: string
}>(), {
  title: '',
  modelValue: () => [],
  options: () => defaultCleanerOptions,
  placeholder: 'Select staff / cleaners',
  emptyText: 'No staff found',
  buttonClass: '',
  compact: false,
  showTags: false,
  disabled: false,
  popoverWidth: 'w-72',
  contentClass: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const open = ref(false)
const search = ref('')

const filteredOptions = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q)
    return props.options
  return props.options.filter(opt =>
    opt.name.toLowerCase().includes(q) || (opt.role && opt.role.toLowerCase().includes(q)),
  )
})

const selectedOptions = computed(() => {
  return props.options.filter(opt => props.modelValue?.includes(opt.id))
})

function isSelected(id: string) {
  return props.modelValue?.includes(id) ?? false
}

function toggleStaff(id: string) {
  const current = [...(props.modelValue ?? [])]
  const idx = current.indexOf(id)
  if (idx === -1) {
    current.push(id)
  }
  else {
    current.splice(idx, 1)
  }
  emit('update:modelValue', current)
}

function removeStaff(id: string) {
  const current = (props.modelValue ?? []).filter(item => item !== id)
  emit('update:modelValue', current)
}

function selectAll() {
  const allIds = props.options.map(opt => opt.id)
  emit('update:modelValue', allIds)
}

function clearAll() {
  emit('update:modelValue', [])
}

const displaySummary = computed(() => {
  const count = props.modelValue?.length ?? 0
  if (count === 0)
    return props.placeholder
  if (count === 1) {
    const found = props.options.find(o => o.id === props.modelValue[0])
    return found ? found.name : props.placeholder
  }
  if (count === 2) {
    const names = selectedOptions.value.map(o => o.name)
    if (names.length === 2)
      return `${names[0]}, ${names[1]}`
  }
  return `${count} staff selected`
})
</script>

<template>
  <div class="space-y-1.5 w-full">
    <Popover v-model:open="open">
      <PopoverTrigger as-child :disabled="disabled">
        <slot
          name="trigger"
          :open="open"
          :display-summary="displaySummary"
          :selected-count="modelValue?.length || 0"
        >
          <button
            type="button"
            class="flex items-center justify-between gap-2 rounded-md border border-input bg-background transition-colors text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            :class="[
              compact ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-xs sm:text-sm w-full',
              buttonClass,
            ]"
          >
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <BasePersonAvatar
                v-if="selectedOptions.length === 1 && selectedOptions[0]"
                :name="selectedOptions[0].name"
                :src="selectedOptions[0].avatar || selectedOptions[0].avatarUrl"
                class="size-5 shrink-0"
                text-class="text-[9px]"
              />
              <div v-else-if="selectedOptions.length > 1" class="flex -space-x-1.5 shrink-0">
                <BasePersonAvatar
                  v-for="st in selectedOptions.slice(0, 2)"
                  :key="st.id"
                  :name="st.name"
                  :src="st.avatar || st.avatarUrl"
                  class="size-5 ring-1 ring-background shrink-0"
                  text-class="text-[8px]"
                />
              </div>
              <Icon v-else name="lucide:user" class="size-3.5 shrink-0 text-muted-foreground" />
              <span
                class="truncate"
                :class="modelValue?.length ? 'text-foreground font-medium' : 'text-muted-foreground'"
              >
                {{ displaySummary }}
              </span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <Badge
                v-if="modelValue?.length > 1"
                variant="secondary"
                class="h-5 px-1.5 text-[10px] font-normal"
              >
                {{ modelValue.length }}
              </Badge>
              <Icon name="lucide:chevrons-up-down" class="size-3 text-muted-foreground opacity-60" />
            </div>
          </button>
        </slot>
      </PopoverTrigger>

      <PopoverContent class="p-0 shadow-md z-[100]" :class="[popoverWidth, contentClass]" align="start">
        <!-- Title header if provided -->
        <div v-if="title" class="px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground border-b">
          <span>{{ title }}</span>
        </div>
        <!-- Search bar -->
        <div class="flex items-center gap-2 border-b px-2.5 py-2">
          <Icon name="lucide:search" class="size-3.5 shrink-0 text-muted-foreground" />
          <input
            v-model="search"
            class="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            placeholder="Search staff by name or role..."
            autofocus
          >
          <button
            v-if="search"
            type="button"
            class="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
            @click="search = ''"
          >
            <Icon name="lucide:x" class="size-3.5" />
          </button>
        </div>

        <!-- Staff List -->
        <ScrollArea class="max-h-56">
          <div class="p-1 space-y-0.5">
            <template v-if="filteredOptions.length > 0">
              <button
                v-for="staff in filteredOptions"
                :key="staff.id"
                type="button"
                class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted cursor-pointer text-left"
                @click="toggleStaff(staff.id)"
              >
                <!-- Checkbox -->
                <div
                  class="flex size-4 shrink-0 items-center justify-center rounded border transition-colors"
                  :class="isSelected(staff.id) ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-background'"
                >
                  <Icon v-if="isSelected(staff.id)" name="lucide:check" class="size-3 stroke-[2.5]" />
                </div>
                <!-- Staff Avatar -->
                <BasePersonAvatar
                  :name="staff.name"
                  :src="staff.avatar || staff.avatarUrl"
                  class="size-6 shrink-0"
                  text-class="text-[10px]"
                />
                <!-- Staff Info -->
                <div class="flex flex-col min-w-0 flex-1">
                  <span class="truncate font-medium text-foreground">{{ staff.name }}</span>
                  <span v-if="staff.role" class="truncate text-[10px] text-muted-foreground">{{ staff.role }}</span>
                </div>
              </button>
            </template>
            <p v-else class="py-6 text-center text-xs text-muted-foreground">
              {{ emptyText }}
            </p>
          </div>
        </ScrollArea>

        <!-- Footer -->
        <div class="flex items-center justify-between border-t px-2.5 py-1.5 bg-muted/20 text-xs">
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="text-[11px] text-primary hover:underline cursor-pointer"
              @click="selectAll"
            >
              Select all
            </button>
            <span class="text-muted-foreground text-[10px]">•</span>
            <button
              type="button"
              class="text-[11px] text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
              @click="clearAll"
            >
              Clear
            </button>
          </div>
          <span class="text-[11px] text-muted-foreground font-mono">
            {{ modelValue?.length || 0 }} selected
          </span>
        </div>
      </PopoverContent>
    </Popover>

    <!-- Selected Staff Chips (removable) -->
    <div v-if="showTags && selectedOptions.length > 0" class="flex flex-wrap gap-1 pt-0.5" data-testid="selected-staff-chips">
      <span
        v-for="staff in selectedOptions"
        :key="staff.id"
        data-testid="staff-chip"
        class="staff-chip inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 pl-1 pr-1.5 py-0.5 text-xs text-primary font-medium"
      >
        <BasePersonAvatar
          :name="staff.name"
          :src="staff.avatar || staff.avatarUrl"
          class="size-4 shrink-0"
          text-class="text-[8px]"
        />
        <span class="truncate max-w-[140px]">{{ staff.name }}</span>
        <button
          type="button"
          class="size-3.5 inline-flex items-center justify-center rounded-full hover:bg-primary/20 hover:text-primary cursor-pointer transition-colors"
          title="Remove"
          @click.stop="removeStaff(staff.id)"
        >
          <Icon name="lucide:x" class="size-2.5" />
        </button>
      </span>
    </div>
  </div>
</template>
