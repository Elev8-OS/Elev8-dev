<script setup lang="ts">
import type { WizardAnswers } from '~/components/website-builder/data/wizard'
import { FORMALITY_PRONOUNS, LANGUAGE_OPTIONS } from '~/components/website-builder/data/wizard'

const emit = defineEmits<{ next: [] }>()
const answers = defineModel<WizardAnswers>({ required: true })
const selected = computed(() => answers.value.languages)
const showFormality = computed(() => selected.value.some(code => FORMALITY_PRONOUNS[code]))

function patch(value: Partial<WizardAnswers>) {
  answers.value = { ...answers.value, ...value }
}

function toggle(code: string) {
  if (selected.value.includes(code)) {
    // The site always keeps one language.
    if (selected.value.length === 1)
      return
    const languages = selected.value.filter(c => c !== code)
    patch({ languages, defaultLanguage: answers.value.defaultLanguage === code ? languages[0]! : answers.value.defaultLanguage })
  }
  else {
    patch({ languages: [...selected.value, code] })
  }
}

// Show the pronoun of the default language so "Formal" reads as "Formal · Sie".
function example(kind: 'formal' | 'informal') {
  const code = FORMALITY_PRONOUNS[answers.value.defaultLanguage] ? answers.value.defaultLanguage : selected.value.find(c => FORMALITY_PRONOUNS[c])
  return code ? FORMALITY_PRONOUNS[code]![kind] : ''
}

// Clicking the active option clears it, back to letting the AI decide.
function setFormality(kind: 'formal' | 'informal') {
  patch({ formality: answers.value.formality === kind ? '' : kind })
}
</script>

<template>
  <div class="flex w-full flex-col items-center py-8">
    <h2 class="text-center text-3xl font-semibold tracking-tight">
      Which languages do you need?
    </h2>
    <p class="mt-2 text-center text-sm text-muted-foreground">
      Pick one or more. Use the star to choose the default language.
    </p>

    <div class="mt-8 flex max-w-xl flex-wrap justify-center gap-3">
      <template v-for="lang in LANGUAGE_OPTIONS" :key="lang.code">
        <div
          v-if="selected.includes(lang.code)"
          class="flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 py-1.5 pl-2 pr-3 text-sm font-semibold"
          :data-testid="`wz-lang-${lang.code}`"
        >
          <button
            type="button"
            class="rounded-full p-1 hover:bg-primary/10"
            :aria-label="answers.defaultLanguage === lang.code ? `${lang.label} is the default language` : `Set ${lang.label} as default language`"
            :aria-pressed="answers.defaultLanguage === lang.code"
            @click="patch({ defaultLanguage: lang.code })"
          >
            <Icon name="lucide:star" class="size-3.5" :class="answers.defaultLanguage === lang.code && 'fill-current text-primary'" aria-hidden="true" />
          </button>
          {{ lang.label }}
          <button
            type="button"
            class="rounded-full p-1 hover:bg-primary/10 disabled:opacity-40"
            :aria-label="`Remove ${lang.label}`"
            :disabled="selected.length === 1"
            @click="toggle(lang.code)"
          >
            <Icon name="lucide:x" class="size-3.5" aria-hidden="true" />
          </button>
        </div>
        <button
          v-else
          type="button"
          class="rounded-full border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-muted-foreground/50"
          :data-testid="`wz-lang-${lang.code}`"
          @click="toggle(lang.code)"
        >
          {{ lang.label }}
        </button>
      </template>
    </div>

    <!-- Only for languages that distinguish formal from informal "you". -->
    <div v-if="showFormality" class="mt-8 flex w-full max-w-md flex-col items-center gap-3" data-testid="wz-formality">
      <p class="text-sm font-semibold">
        How should the site address guests?
      </p>
      <div class="flex gap-3">
        <button
          v-for="kind in (['formal', 'informal'] as const)"
          :key="kind"
          type="button"
          class="rounded-full border px-4 py-2 text-sm font-medium capitalize transition-colors"
          :class="answers.formality === kind ? 'border-primary bg-primary/10 font-semibold' : 'bg-background hover:border-muted-foreground/50'"
          :aria-pressed="answers.formality === kind"
          @click="setFormality(kind)"
        >
          {{ kind }}<span v-if="example(kind)" class="text-muted-foreground"> · {{ example(kind) }}</span>
        </button>
      </div>
      <p class="text-center text-xs text-muted-foreground">
        {{ answers.formality ? 'Applied across all generated copy and translations.' : 'Not set. The AI picks per language, which usually means the formal form.' }}
      </p>
    </div>

    <div class="mt-8 flex w-full max-w-sm flex-col items-center gap-2">
      <div class="flex cursor-pointer items-center gap-2" @click="patch({ autoDetectLanguage: !answers.autoDetectLanguage })">
        <div
          class="flex size-4 items-center justify-center rounded-[4px] border"
          :class="answers.autoDetectLanguage ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
        >
          <Icon v-if="answers.autoDetectLanguage" name="lucide:check" class="size-3" />
        </div>
        <span class="text-sm">Auto-detect visitor language</span>
      </div>
      <p v-if="answers.autoDetectLanguage" class="text-center text-xs text-muted-foreground">
        If the visitor's browser language is one of the selected languages, the site opens in it. Otherwise it opens in the default.
      </p>
    </div>

    <div class="mt-8 flex flex-col items-center gap-3">
      <Button data-testid="wz-continue" @click="emit('next')">
        Continue
      </Button>
      <button type="button" class="text-sm text-muted-foreground transition-colors hover:text-foreground" data-testid="wz-skip" @click="emit('next')">
        Skip, I'll set this later.
      </button>
    </div>
  </div>
</template>
