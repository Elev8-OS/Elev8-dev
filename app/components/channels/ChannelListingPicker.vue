<script setup lang="ts">
import { computed, ref } from 'vue'

export interface PickerOption {
  id: string
  name: string
  location: string
  /** Why it cannot be picked here, or undefined when it can. */
  disabledReason?: string
}

const props = defineProps<{ options: PickerOption[], label: string }>()

const model = defineModel<string | null>({ required: true })

const open = ref(false)
const search = ref('')

const selected = computed(() => props.options.find(o => o.id === model.value))

function pick(id: string | null) {
  model.value = id
  open.value = false
  search.value = ''
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        class="h-9 w-full justify-between gap-2 px-3 font-normal"
        :class="selected ? '' : 'text-muted-foreground'"
        :aria-label="label"
      >
        <span class="truncate">{{ selected?.name ?? "Don't sync" }}</span>
        <Icon name="lucide:chevrons-up-down" class="size-3.5 shrink-0 opacity-50" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[min(340px,calc(100vw-2rem))] p-0" align="end" :side-offset="4">
      <Command>
        <CommandInput v-model="search" placeholder="Search Elev8 listings..." class="h-9" />
        <CommandList class="max-h-72">
          <CommandEmpty class="py-3 text-center text-xs text-muted-foreground">
            No listing found.
          </CommandEmpty>
          <CommandGroup>
            <CommandItem value="don't sync" class="gap-2" @select="pick(null)">
              <Icon name="lucide:circle-slash" class="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span class="text-sm">Don't sync</span>
              <Icon v-if="model === null" name="lucide:check" class="ml-auto size-3.5" aria-hidden="true" />
            </CommandItem>
            <CommandItem
              v-for="o in options"
              :key="o.id"
              :value="`${o.name} ${o.location}`"
              :disabled="!!o.disabledReason"
              class="items-start gap-2"
              @select="pick(o.id)"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm">
                  {{ o.name }}
                </p>
                <p class="truncate text-xs text-muted-foreground">
                  {{ o.disabledReason ?? o.location }}
                </p>
              </div>
              <Icon v-if="model === o.id" name="lucide:check" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
