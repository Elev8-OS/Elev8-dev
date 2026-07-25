<!-- app/components/owners/OwnerOnboardingBasics.vue -->
<!--
  Step 1 of the owner onboarding flow: identity + language + statement
  currency. Emits copied patches so the parent never sees alias mutations.
-->
<script setup lang="ts">
import type { OwnerLanguage, StatementCurrency } from '~/components/owners/data/owners'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'

export interface OwnerBasicsDraft {
  name: string
  email: string
  phone: string
  language: OwnerLanguage
  statementCurrency: StatementCurrency
}

interface Props {
  draft: OwnerBasicsDraft
  errors: Partial<Record<keyof OwnerBasicsDraft, string>>
  emailTaken: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:draft': [value: OwnerBasicsDraft]
}>()

function patch(partial: Partial<OwnerBasicsDraft>) {
  emit('update:draft', { ...props.draft, ...partial })
}

const languageOptions: { value: OwnerLanguage, label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'id', label: 'Bahasa Indonesia' },
]

const currencyOptions: { value: StatementCurrency, label: string }[] = [
  { value: 'IDR', label: 'IDR — Indonesian Rupiah' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
]
</script>

<template>
  <div class="space-y-4" data-testid="owner-onboarding-basics">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="space-y-1.5">
        <Label for="owner-name">
          Full name
        </Label>
        <Input
          id="owner-name"
          placeholder="e.g. Wayan Sari"
          :model-value="draft.name"
          @update:model-value="(v: string | number) => patch({ name: String(v) })"
        />
        <p v-if="errors.name" class="text-xs text-destructive">
          {{ errors.name }}
        </p>
      </div>

      <div class="space-y-1.5">
        <Label for="owner-email">
          Email <span class="text-destructive">*</span>
        </Label>
        <Input
          id="owner-email"
          type="email"
          autocomplete="email"
          placeholder="owner@example.com"
          :model-value="draft.email"
          @update:model-value="(v: string | number) => patch({ email: String(v) })"
        />
        <p v-if="errors.email" class="text-xs text-destructive">
          {{ emailTaken ? 'An owner with this email already exists.' : errors.email }}
        </p>
      </div>

      <div class="space-y-1.5">
        <Label for="owner-phone">
          Phone
        </Label>
        <Input
          id="owner-phone"
          type="tel"
          placeholder="+62..."
          :model-value="draft.phone"
          @update:model-value="(v: string | number) => patch({ phone: String(v) })"
        />
      </div>

      <div class="space-y-1.5">
        <Label>Language</Label>
        <Select
          :model-value="draft.language"
          @update:model-value="(v) => patch({ language: v as OwnerLanguage })"
        >
          <SelectTrigger class="w-full">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="opt in languageOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="space-y-1.5 sm:col-span-2">
        <Label>Statement currency</Label>
        <Select
          :model-value="draft.statementCurrency"
          @update:model-value="(v) => patch({ statementCurrency: v as StatementCurrency })"
        >
          <SelectTrigger class="w-full">
            <SelectValue placeholder="Select currency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="opt in currencyOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  </div>
</template>
