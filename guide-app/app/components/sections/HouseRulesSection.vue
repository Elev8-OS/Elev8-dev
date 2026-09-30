<script setup lang="ts">
// Each rule is a title with an optional description; older guides stored
// plain strings, which read as a title only.
interface HouseRule {
  title: string
  description?: string
}

const props = defineProps<{
  data: {
    rules?: Array<string | HouseRule>
  }
  listing?: {
    resources?: {
      basics?: {
        houseRules?: string
      }
    }
  }
  token?: string
}>()

function normalize(entries: unknown[]): HouseRule[] {
  return entries.flatMap((entry): HouseRule[] => {
    if (typeof entry === 'string')
      return entry.trim() ? [{ title: entry.trim() }] : []
    if (entry && typeof entry === 'object') {
      const title = String((entry as HouseRule).title ?? '').trim()
      const description = String((entry as HouseRule).description ?? '').trim()
      return title ? [{ title, description: description || undefined }] : []
    }
    return []
  })
}

const rules = computed<HouseRule[]>(() => {
  const fromGuide = normalize(props.data?.rules ?? [])
  if (fromGuide.length)
    return fromGuide
  return normalize(props.listing?.resources?.basics?.houseRules?.split('\n') ?? [])
})

const { translate } = useAutoTranslate()
</script>

<template>
  <section class="rounded-xl border bg-card p-6">
    <div class="mb-3 flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon name="lucide:scroll" class="size-5" />
      </div>
      <h2 class="text-xl font-semibold">
        {{ translate('House Rules') }}
      </h2>
    </div>
    <ul v-if="rules.length" class="space-y-3">
      <li
        v-for="(rule, idx) in rules"
        :key="idx"
        class="flex items-start gap-2 text-sm md:text-base"
      >
        <Icon name="lucide:check" class="mt-0.5 size-4 flex-shrink-0 text-emerald-600" />
        <div class="min-w-0">
          <p class="font-medium">
            {{ translate(rule.title) }}
          </p>
          <p v-if="rule.description" class="mt-0.5 text-sm text-muted-foreground">
            {{ translate(rule.description) }}
          </p>
        </div>
      </li>
    </ul>
    <p v-else class="text-sm text-muted-foreground">
      {{ translate('No specific house rules.') }}
    </p>
  </section>
</template>