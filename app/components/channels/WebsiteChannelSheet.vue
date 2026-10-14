<script setup lang="ts">
import type { WebsiteRuleSet, WebsiteSettingsIssue } from './data/website-channel'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { websites } from '~/components/website-builder/data/websites'
import { useWebsiteChannel } from '~/composables/useWebsiteChannel'
import { cloneRuleSet, newRuleSet, ruleSetSummary, unassignedWebsiteIds, WEBSITE_CHANNEL } from './data/website-channel'
import WebsiteRuleSetForm from './WebsiteRuleSetForm.vue'

/** 'new' opens straight on a new rule set (adding the channel); 'list' opens the rule set list. */
const props = withDefaults(defineProps<{ start?: 'list' | 'new' }>(), { start: 'list' })

const emit = defineEmits<{ remove: [] }>()

const open = defineModel<boolean>('open', { default: false })

const { websiteChannel, ruleSets, getRuleSet, saveRuleSet, deleteRuleSet } = useWebsiteChannel()

// Websites in no rule set get no Website discounts; listed so nobody misses them.
const unassigned = computed(() => {
  const ids = unassignedWebsiteIds(websiteChannel.value, websites.value.map(w => w.id))
  return websites.value.filter(w => ids.includes(w.id))
})

// The editor works on a copy; nothing changes until Save.
const draft = ref<WebsiteRuleSet | null>(null)
const isNew = ref(false)
const issues = ref<WebsiteSettingsIssue[]>([])
const deleteOpen = ref(false)

function edit(set: WebsiteRuleSet) {
  draft.value = cloneRuleSet(set)
  isNew.value = false
  issues.value = []
}

function add() {
  draft.value = newRuleSet('')
  isNew.value = true
  issues.value = []
}

/** With no rule set saved yet there is no list to go back to, so close instead. */
function backToList() {
  draft.value = null
  issues.value = []
  if (ruleSets.value.length === 0)
    open.value = false
}

watch(open, (isOpen) => {
  if (!isOpen)
    return
  if (props.start === 'new' || ruleSets.value.length === 0)
    add()
  else
    backToList()
})

function websiteNames(set: WebsiteRuleSet) {
  return websites.value.filter(w => set.websiteIds.includes(w.id)).map(w => w.name)
}

function websitesLine(set: WebsiteRuleSet) {
  const names = websiteNames(set)
  if (names.length === 0)
    return 'No websites assigned'
  return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
}

const title = computed(() => {
  if (!draft.value)
    return 'Website'
  if (isNew.value)
    return ruleSets.value.length === 0 ? 'Add Website channel' : 'New rule set'
  return draft.value.name || 'Rule set'
})

function onSave() {
  if (!draft.value)
    return
  const addsChannel = !websiteChannel.value.enabled
  issues.value = saveRuleSet(draft.value)
  if (issues.value.length > 0) {
    toast.error('Check the highlighted settings', { description: issues.value[0]!.message })
    return
  }
  const name = draft.value.name.trim()
  if (addsChannel)
    toast.success('Website channel added', { description: `Rule set "${name}" is live on its websites.` })
  else
    toast.success(isNew.value ? `Rule set "${name}" added` : `Rule set "${name}" saved`)
  backToList()
}

function confirmDelete() {
  if (!draft.value)
    return
  const name = draft.value.name
  const moved = getRuleSet(draft.value.id)?.websiteIds.length ?? 0
  if (deleteRuleSet(draft.value.id)) {
    toast.info(`Rule set "${name}" deleted`, { description: moved > 0 ? `${moved} ${moved === 1 ? 'website has' : 'websites have'} no Website discounts until you add them to a rule set.` : undefined })
    backToList()
  }
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
      <SheetHeader class="border-b p-5">
        <div class="flex items-center gap-3">
          <Button v-if="draft && ruleSets.length > 0" variant="ghost" size="icon" class="size-9 shrink-0" aria-label="Back to rule sets" @click="backToList">
            <Icon name="lucide:arrow-left" class="size-4" />
          </Button>
          <div v-else class="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
            <Icon :name="WEBSITE_CHANNEL.icon" class="size-5" />
          </div>
          <div class="min-w-0">
            <SheetTitle class="truncate">
              {{ title }}
            </SheetTitle>
            <SheetDescription>
              <template v-if="!draft">
                Discounts and stay rules for direct bookings, per website. Each website uses one rule set.
              </template>
              <template v-else>
                Name the rule set, pick its websites, then set their discounts and stay rules.
              </template>
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div class="min-h-0 flex-1 overflow-y-auto">
        <div v-if="draft" class="p-5">
          <WebsiteRuleSetForm v-model:rule-set="draft" :issues="issues" />
        </div>

        <ul v-else class="flex flex-col p-3">
          <li v-for="set in ruleSets" :key="set.id">
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-md px-2 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              :aria-label="`Edit rule set ${set.name}`"
              data-testid="wrs-row"
              @click="edit(set)"
            >
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-2 text-sm font-medium">
                  <span class="truncate">{{ set.name }}</span>
                </p>
                <p class="truncate text-xs text-muted-foreground">
                  {{ websitesLine(set) }}
                </p>
                <p class="truncate text-xs text-muted-foreground">
                  {{ ruleSetSummary(set) }}
                </p>
              </div>
              <span class="shrink-0 text-sm tabular-nums">
                {{ websiteNames(set).length }}
                <span class="sr-only">{{ websiteNames(set).length === 1 ? 'website' : 'websites' }}</span>
              </span>
              <Icon name="lucide:chevron-right" class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </li>
          <li v-if="unassigned.length > 0" class="mt-2 rounded-md bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
            <span class="font-medium text-foreground">Not in a rule set:</span>
            {{ unassigned.map(w => w.name).join(', ') }}. They take direct bookings without Website discounts or rules.
          </li>
        </ul>
      </div>

      <SheetFooter v-if="draft" class="flex-row items-center justify-between gap-2 border-t p-4">
        <Button v-if="!isNew" data-testid="wrs-delete" variant="ghost" class="text-destructive hover:text-destructive" @click="deleteOpen = true">
          Delete rule set
        </Button>
        <span v-else />
        <div class="flex gap-2">
          <Button variant="outline" @click="backToList">
            Cancel
          </Button>
          <Button data-testid="wrs-save" @click="onSave">
            {{ !isNew ? 'Save' : ruleSets.length === 0 ? 'Add channel' : 'Add rule set' }}
          </Button>
        </div>
      </SheetFooter>
      <SheetFooter v-else class="flex-row items-center justify-between gap-2 border-t p-4">
        <Button variant="ghost" class="text-destructive hover:text-destructive" @click="emit('remove')">
          Remove channel
        </Button>
        <Button data-testid="wrs-add" @click="add">
          <Icon name="lucide:plus" class="mr-1.5 size-4" aria-hidden="true" />
          Add rule set
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>

  <AlertDialog v-model:open="deleteOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete rule set "{{ draft?.name }}"?</AlertDialogTitle>
        <AlertDialogDescription>
          Its websites take direct bookings without Website discounts or rules until you add them to another rule set.
          Existing reservations keep the price they were booked at.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction data-testid="wrs-delete-confirm" class="bg-destructive text-white hover:bg-destructive/90" @click="confirmDelete">
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
