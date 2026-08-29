<script setup lang="ts">
import { mockTenants } from '~/components/platform-console/data/tenants'

interface Props {
  modelValue: string[]
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const open = ref(false)
const search = ref('')

const selected = computed(() => new Set(props.modelValue))

const filteredTenants = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q)
    return mockTenants
  return mockTenants.filter(t => t.name.toLowerCase().includes(q) || t.contactEmail.toLowerCase().includes(q))
})

function toggle(id: string) {
  const next = new Set(selected.value)
  if (next.has(id))
    next.delete(id)
  else
    next.add(id)
  emit('update:modelValue', Array.from(next))
}

function clearAll() {
  emit('update:modelValue', [])
  search.value = ''
}

function removeOne(id: string) {
  emit('update:modelValue', props.modelValue.filter(x => x !== id))
}

const selectedTenants = computed(() =>
  mockTenants.filter(t => selected.value.has(t.id)),
)
</script>

<template>
  <div class="space-y-2">
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <Button variant="outline" class="w-full justify-start font-normal">
          <Icon name="lucide:building-2" class="mr-2 size-4 text-muted-foreground" />
          <span v-if="modelValue.length === 0" class="text-muted-foreground">
            Select tenants...
          </span>
          <span v-else class="text-sm">
            {{ modelValue.length }} tenant{{ modelValue.length === 1 ? '' : 's' }} selected
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-80 p-0" align="start">
        <div class="border-b p-2">
          <Input v-model="search" placeholder="Search tenants..." class="h-8" />
        </div>
        <ScrollArea class="h-64">
          <div class="p-1">
            <div
              v-for="t in filteredTenants"
              :key="t.id"
              class="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted"
              @click="toggle(t.id)"
            >
              <div
                class="flex size-4 items-center justify-center rounded-[4px] border"
                :class="selected.has(t.id)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input'"
              >
                <Icon v-if="selected.has(t.id)" name="lucide:check" class="size-3" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm truncate">
                  {{ t.name }}
                </div>
                <div class="text-xs text-muted-foreground truncate">
                  {{ t.contactEmail }}
                </div>
              </div>
            </div>
            <div v-if="filteredTenants.length === 0" class="p-4 text-center text-sm text-muted-foreground">
              No tenants match "{{ search }}"
            </div>
          </div>
        </ScrollArea>
        <div class="border-t p-2 flex justify-between">
          <span class="text-xs text-muted-foreground self-center">
            {{ modelValue.length }} selected
          </span>
          <Button variant="ghost" size="sm" :disabled="modelValue.length === 0" @click="clearAll">
            Clear all
          </Button>
        </div>
      </PopoverContent>
    </Popover>

    <div v-if="selectedTenants.length > 0" class="flex flex-wrap gap-1">
      <Badge
        v-for="t in selectedTenants.slice(0, 4)"
        :key="t.id"
        variant="secondary"
        class="gap-1"
      >
        {{ t.name }}
        <button
          type="button"
          class="ml-1 rounded-full hover:bg-muted-foreground/20"
          @click.stop="removeOne(t.id)"
        >
          <Icon name="lucide:x" class="size-3" />
        </button>
      </Badge>
      <Badge v-if="selectedTenants.length > 4" variant="outline">
        +{{ selectedTenants.length - 4 }} more
      </Badge>
    </div>
  </div>
</template>
