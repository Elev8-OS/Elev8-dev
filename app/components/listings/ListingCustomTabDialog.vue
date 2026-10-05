<script setup lang="ts">
/** Add or edit a custom tab on the listing page: a name and a web address. */
import type { ListingCustomTab } from '~/components/listings/data/listing-custom-tabs'
import { CUSTOM_TAB_NAME_MAX, normalizeTabUrl } from '~/components/listings/data/listing-custom-tabs'

const props = defineProps<{ open: boolean, tab?: ListingCustomTab | null }>()
const emit = defineEmits<{ 'update:open': [open: boolean], 'save': [tab: ListingCustomTab] }>()

const name = ref('')
const url = ref('')
const urlTouched = ref(false)

watch(() => props.open, (open) => {
  if (!open)
    return
  name.value = props.tab?.name ?? ''
  url.value = props.tab?.url ?? ''
  urlTouched.value = false
}, { immediate: true })

const normalizedUrl = computed(() => normalizeTabUrl(url.value))
const urlError = computed(() => urlTouched.value && url.value.trim() !== '' && !normalizedUrl.value)
const canSave = computed(() => name.value.trim() !== '' && !!normalizedUrl.value)

function save() {
  if (!canSave.value)
    return
  emit('save', {
    id: props.tab?.id ?? `ctab-${Date.now().toString(36)}`,
    name: name.value.trim().slice(0, CUSTOM_TAB_NAME_MAX),
    url: normalizedUrl.value!,
  })
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ tab ? 'Edit tab' : 'Add custom tab' }}</DialogTitle>
        <DialogDescription>
          Open a web page inside this listing, such as a shared sheet, a document or an owner dashboard.
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" @submit.prevent="save">
        <div class="flex flex-col gap-2">
          <Label for="custom-tab-name">Tab name</Label>
          <Input
            id="custom-tab-name"
            v-model="name"
            :maxlength="CUSTOM_TAB_NAME_MAX"
            placeholder="e.g. Inventory sheet"
            autocomplete="off"
          />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="custom-tab-url">Link</Label>
          <Input
            id="custom-tab-url"
            v-model="url"
            type="url"
            inputmode="url"
            placeholder="https://docs.google.com/..."
            autocomplete="off"
            :aria-invalid="urlError || undefined"
            @blur="urlTouched = true"
          />
          <p v-if="urlError" class="text-xs text-destructive" data-testid="custom-tab-url-error">
            Enter a web address starting with http:// or https://
          </p>
          <p v-else class="text-xs text-muted-foreground">
            Some sites do not allow being shown inside another page. Those still open in a new browser tab.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="emit('update:open', false)">
            Cancel
          </Button>
          <Button type="submit" :disabled="!canSave" data-testid="custom-tab-save">
            {{ tab ? 'Save' : 'Add tab' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
