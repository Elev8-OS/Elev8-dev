<script setup lang="ts">
import type { DescriptionTranslation } from '~/components/listings/data/listing-content'
import type { Listing } from '~/components/listings/data/listings'
import { computed, ref } from 'vue'
import { DESCRIPTION_LANGUAGES, languageLabel, listingDescriptionTranslations } from '~/components/listings/data/listing-content'

/**
 * The property and neighborhood descriptions in other languages, for channels
 * that show guests their own language. English is the Listing Details fields
 * above. Edits go to the setup draft like every other field.
 */
const props = defineProps<{ listing: Listing }>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const translations = computed(() => listingDescriptionTranslations(props.listing))
const codes = computed(() => DESCRIPTION_LANGUAGES.map(l => l.code).filter(c => translations.value[c]))
const addable = computed(() => DESCRIPTION_LANGUAGES.filter(l => !translations.value[l.code]))
const open = ref<string[]>(codes.value.length ? ['translations'] : [])

function write(next: Record<string, DescriptionTranslation>) {
  emit('update', { ...props.listing, descriptionTranslations: next })
}

function add(code: unknown) {
  if (typeof code !== 'string' || translations.value[code])
    return
  write({ ...translations.value, [code]: { description: '', neighborhood: '' } })
}

function set(code: string, key: keyof DescriptionTranslation, value: string) {
  write({ ...translations.value, [code]: { ...translations.value[code]!, [key]: value } })
}

function remove(code: string) {
  const next = { ...translations.value }
  delete next[code]
  write(next)
}
</script>

<template>
  <Accordion v-model="open" type="multiple" class="rounded-lg border px-4" data-testid="setup-translations">
    <AccordionItem value="translations">
      <AccordionTrigger class="items-center hover:no-underline">
        <span class="flex flex-1 items-center gap-2">Descriptions in other languages</span>
        <span class="text-xs font-normal text-muted-foreground">
          {{ codes.length ? codes.map(languageLabel).join(', ') : 'English only' }}
        </span>
      </AccordionTrigger>
      <AccordionContent class="flex flex-col gap-4 px-0.5">
        <p class="text-xs text-muted-foreground">
          English is "Describe the property" and "Describe the neighborhood" above. Channels show a language you add here to
          guests who browse in it, and English to everyone else.
        </p>

        <section
          v-for="code in codes"
          :key="code"
          class="flex flex-col gap-3 rounded-lg border p-3"
          :aria-label="`${languageLabel(code)} descriptions`"
        >
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-medium">
              {{ languageLabel(code) }}
            </p>
            <Button variant="ghost" size="sm" class="text-destructive hover:text-destructive" :aria-label="`Remove ${languageLabel(code)}`" @click="remove(code)">
              <Icon name="lucide:trash-2" class="size-4" />
            </Button>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label :for="`translation-description-${code}`" class="text-xs">The property</Label>
            <Textarea
              :id="`translation-description-${code}`"
              :model-value="translations[code]!.description"
              rows="4"
              @update:model-value="v => set(code, 'description', String(v))"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label :for="`translation-neighborhood-${code}`" class="text-xs">The neighborhood</Label>
            <Textarea
              :id="`translation-neighborhood-${code}`"
              :model-value="translations[code]!.neighborhood"
              rows="3"
              @update:model-value="v => set(code, 'neighborhood', String(v))"
            />
          </div>
        </section>

        <Select v-if="addable.length" :model-value="undefined" @update:model-value="add">
          <SelectTrigger class="w-full sm:w-60" aria-label="Add a language">
            <SelectValue placeholder="Add a language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="lang in addable" :key="lang.code" :value="lang.code">
              {{ lang.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</template>
