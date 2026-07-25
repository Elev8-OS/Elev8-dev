<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePromoCodes } from '~/composables/usePromoCodes'
import { formatPromoDiscount } from './data/promo-codes'

const modelValue = defineModel<string[]>({ default: () => [] })

const { codes, getPromoCodeStatus: status } = usePromoCodes()

const popoverOpen = ref(false)
const search = ref('')
const activeOnly = ref(false)

const filteredCodes = computed(() => {
  const query = search.value.trim().toLowerCase()
  return codes.value.filter((code) => {
    if (activeOnly.value && status(code) !== 'active')
      return false
    if (query) {
      const haystack = `${code.code} ${code.description ?? ''}`.toLowerCase()
      if (!haystack.includes(query))
        return false
    }
    return true
  })
})

const selectedCodes = computed(() => codes.value.filter(c => modelValue.value.includes(c.id)))

function toggle(id: string) {
  modelValue.value = modelValue.value.includes(id)
    ? modelValue.value.filter(x => x !== id)
    : [...modelValue.value, id]
}

function clear() {
  modelValue.value = []
}

function isSelected(id: string) {
  return modelValue.value.includes(id)
}

const triggerLabel = computed(() => {
  const n = modelValue.value.length
  if (n === 0)
    return 'Select promo codes'
  if (n === 1)
    return '1 code selected'
  return `${n} codes selected`
})

watch(popoverOpen, (open) => {
  if (!open)
    search.value = ''
})
</script>

<template>
  <div class="space-y-2">
    <Popover v-model:open="popoverOpen">
      <PopoverTrigger as-child>
        <Button variant="outline" class="w-full justify-between" aria-label="Select promo codes">
          <span class="truncate">{{ triggerLabel }}</span>
          <div class="flex items-center gap-2">
            <Badge v-if="modelValue.length > 0" variant="secondary" class="h-4 min-w-4 rounded-full px-1 text-[9px]" :aria-label="`${modelValue.length} selected`">
              {{ modelValue.length }}
            </Badge>
            <Icon name="i-lucide-chevron-down" class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-[420px] p-0" align="start" :side-offset="4">
        <div class="p-2 border-b space-y-2">
          <Input v-model="search" placeholder="Search codes..." class="h-8 text-sm" aria-label="Search promo codes" />
          <div class="flex items-center justify-between gap-2">
            <button
              type="button"
              class="flex items-center gap-1.5 cursor-pointer"
              role="checkbox"
              :aria-checked="activeOnly ? 'true' : 'false'"
              aria-label="Show active codes only"
              @click="activeOnly = !activeOnly"
            >
              <span class="flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border" :class="activeOnly ? 'border-primary bg-primary text-primary-foreground' : 'border-input'" aria-hidden="true">
                <Icon v-if="activeOnly" name="lucide:check" class="size-2.5" />
              </span>
              <span class="text-xs">Active only</span>
            </button>
            <Button v-if="modelValue.length > 0" type="button" variant="ghost" size="sm" class="h-6 text-xs" @click="clear">
              Clear
            </Button>
          </div>
        </div>
        <Command>
          <CommandList>
            <CommandEmpty>No codes found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                v-for="code in filteredCodes"
                :key="code.id"
                :value="code.code"
                class="cursor-pointer"
                @select="() => toggle(code.id)"
              >
                <div
                  class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                  :class="isSelected(code.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                  role="checkbox"
                  :aria-checked="isSelected(code.id) ? 'true' : 'false'"
                  :aria-label="`Toggle ${code.code}`"
                >
                  <Icon v-if="isSelected(code.id)" name="lucide:check" class="size-3" aria-hidden="true" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-mono text-sm font-medium truncate">
                    {{ code.code }}
                  </p>
                  <p v-if="code.description" class="text-xs text-muted-foreground truncate">
                    {{ code.description }}
                  </p>
                </div>
                <Badge variant="outline" class="ml-auto text-[10px]">
                  {{ formatPromoDiscount(code) }}
                </Badge>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
        <div class="flex items-center justify-between gap-2 border-t p-2">
          <span class="text-xs text-muted-foreground" aria-live="polite">{{ modelValue.length }} selected</span>
          <Button type="button" size="sm" class="h-7" @click="popoverOpen = false">
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>

    <ul v-if="selectedCodes.length > 0" class="flex flex-wrap gap-1.5" role="list" aria-label="Selected promo codes">
      <li v-for="code in selectedCodes" :key="code.id">
        <Badge variant="secondary" class="gap-1 pr-1">
          <span class="font-mono">{{ code.code }}</span>
          <button
            type="button"
            class="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5"
            :aria-label="`Remove ${code.code}`"
            @click="toggle(code.id)"
          >
            <Icon name="lucide:x" class="size-3" aria-hidden="true" />
          </button>
        </Badge>
      </li>
    </ul>
  </div>
</template>
