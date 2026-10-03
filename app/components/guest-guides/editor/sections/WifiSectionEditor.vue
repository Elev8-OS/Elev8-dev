<script setup lang="ts">
import { Icon } from '#components'
import { computed, inject, ref } from 'vue'
import { listings } from '~/components/listings/data/listings'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import { Textarea } from '~/components/ui/textarea'

const props = defineProps<{ modelValue: Record<string, any> }>()
const emit = defineEmits<{ 'update:modelValue': [v: Record<string, any>] }>()

function update(patch: Record<string, any>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

const showPassword = ref(false)

// Pull the assigned listing IDs from the parent GuideEditor (defaults to empty).
const assignedListingIds = inject<Ref<string[]>>('assignedListingIds', ref([]))

// Resolve the listings currently assigned to this guide (for fallback hints).
const assignedListings = computed(() =>
  listings.value.filter(l => assignedListingIds.value.includes(l.id)),
)

const singleListing = computed(() =>
  assignedListings.value.length === 1 ? assignedListings.value[0] : null,
)

const defaultSsid = computed(() => singleListing.value?.wifiSsid ?? null)
const defaultPassword = computed(() => singleListing.value?.wifiPassword ?? null)
</script>

<template>
  <div class="space-y-3">
    <div
      v-if="assignedListings.length === 0"
      class="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground"
    >
      Assign this guide to a listing first to see default values.
    </div>
    <div
      v-else-if="assignedListings.length === 1"
      class="space-y-1 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground"
    >
      <div>
        Default from listing "<strong>{{ singleListing?.name }}</strong>" — override below if needed.
      </div>
      <div v-if="defaultSsid" class="font-mono text-foreground">
        SSID: {{ defaultSsid }}
      </div>
      <div v-if="defaultPassword" class="font-mono text-foreground">
        Password: {{ defaultPassword }}
      </div>
    </div>
    <div
      v-else
      class="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground"
    >
      Defaults vary across {{ assignedListings.length }} listings. Use per-listing overrides (coming soon).
    </div>

    <div>
      <Label>Network name (SSID)</Label>
      <Input
        :model-value="modelValue.ssid ?? ''"
        placeholder="Leave blank to use listing default"
        @update:model-value="update({ ssid: $event })"
      />
    </div>

    <div>
      <Label>Password</Label>
      <div class="flex gap-2">
        <Input
          :type="showPassword ? 'text' : 'password'"
          :model-value="modelValue.password ?? ''"
          placeholder="Leave blank to use listing default"
          @update:model-value="update({ password: $event })"
        />
        <Button
          variant="outline"
          size="icon"
          type="button"
          aria-label="Toggle password visibility"
          @click="showPassword = !showPassword"
        >
          <Icon :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'" class="size-4" />
        </Button>
      </div>
    </div>

    <div class="flex items-center justify-between rounded-md border p-3">
      <div>
        <Label>Show password by default</Label>
        <p class="mt-1 text-xs text-muted-foreground">
          Reveal the password to guests without toggling.
        </p>
      </div>
      <Switch
        :model-value="!!modelValue.showPasswordByDefault"
        @update:model-value="update({ showPasswordByDefault: $event })"
      />
    </div>

    <div>
      <Label>Network notes</Label>
      <Textarea
        :model-value="modelValue.networkNotes ?? ''"
        rows="3"
        placeholder="e.g. 5GHz available, signal strongest near living room"
        @update:model-value="update({ networkNotes: $event })"
      />
    </div>
  </div>
</template>
