<script setup lang="ts">
import ExpandableText from '~/../app/components/shared/ExpandableText.vue'
// The listing owns its rules (the dashboard's listing Guest Guide tab), sent by
// the guide endpoint as `guideContent.house_rules`: a title and optional text.
interface HouseRuleItem {
  id: string
  title: string
  text?: string
}

const props = defineProps<{
  data: Record<string, unknown>
  listing?: unknown
  content?: HouseRuleItem[]
  token?: string
}>()

const rules = computed(() => (props.content ?? []).map(item => ({ title: item.title, description: item.text })))

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
          <ExpandableText
            v-if="rule.description"
            :html="rule.description"
            class="mt-0.5 text-sm text-muted-foreground"
          />
        </div>
      </li>
    </ul>
    <p v-else class="text-sm text-muted-foreground">
      {{ translate('No specific house rules.') }}
    </p>
  </section>
</template>
