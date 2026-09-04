<script setup lang="ts">
import type { PromoCodeFormDraft, PromoCodeFormErrors } from './data/promo-code-form'
import { ref } from 'vue'

/**
 * Step 1 fields — what the guest types, and what the team calls it.
 * Shared by the create wizard and the edit form so the labels and the
 * validation copy cannot drift between the two surfaces.
 */
const props = defineProps<{
  errors: PromoCodeFormErrors
  /** Keeps DOM ids unique when create and edit are both mounted. */
  idPrefix: string
}>()

const draft = defineModel<PromoCodeFormDraft>({ required: true })

const codeInputRef = ref<unknown>(null)

function onCodeInput(event: Event) {
  const target = event.target as HTMLInputElement
  const upper = target.value.toUpperCase().replace(/\s+/g, '')
  target.value = upper
  draft.value = { ...draft.value, code: upper }
}

/**
 * A template ref on a shadcn component yields the component instance, not the
 * element — reach through `$el` before focusing, or the wizard's
 * "jump back to the bad field" call throws.
 */
function focusElement(target: unknown): void {
  const el = (target as { $el?: unknown } | null)?.$el ?? target
  if (el instanceof HTMLElement)
    el.focus()
}

defineExpose({ focus: () => focusElement(codeInputRef.value) })
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="space-y-2">
      <Label :for="`${props.idPrefix}-code`">Code</Label>
      <Input
        :id="`${props.idPrefix}-code`"
        ref="codeInputRef"
        :model-value="draft.code"
        placeholder="WELCOME10"
        class="font-mono uppercase"
        :class="props.errors.code ? 'border-destructive' : ''"
        :aria-invalid="props.errors.code ? 'true' : 'false'"
        :aria-describedby="props.errors.code ? `${props.idPrefix}-code-error` : `${props.idPrefix}-code-help`"
        @input="onCodeInput"
      />
      <p
        v-if="props.errors.code"
        :id="`${props.idPrefix}-code-error`"
        role="alert"
        class="text-xs text-destructive"
      >
        {{ props.errors.code }}
      </p>
      <p v-else :id="`${props.idPrefix}-code-help`" class="text-xs text-muted-foreground">
        Guests type this at checkout. Spaces are removed and letters are capitalised automatically.
      </p>
    </div>

    <div class="space-y-2">
      <Label :for="`${props.idPrefix}-description`">
        Description <span class="font-normal text-muted-foreground">(optional)</span>
      </Label>
      <Textarea
        :id="`${props.idPrefix}-description`"
        :model-value="draft.description"
        placeholder="What is this code for?"
        rows="2"
        :aria-describedby="`${props.idPrefix}-description-help`"
        @update:model-value="(v) => draft = { ...draft, description: String(v) }"
      />
      <p :id="`${props.idPrefix}-description-help`" class="text-xs text-muted-foreground">
        Internal note for your team. Guests never see it.
      </p>
    </div>
  </div>
</template>
