<script setup lang="ts">
import type { ObjectiveBasis } from '~/components/revenue/data/health'
import type { AutonomyMode, AutonomyRule } from '~/components/revenue/data/revenue-settings'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { allTags } from '~/components/listings/data/listings'
import { basisLabels } from '~/components/revenue/data/health'
import { newId } from '~/components/revenue/data/revenue-policy'
import { autonomyModeLabels } from '~/components/revenue/data/revenue-settings'
import RevenueNumberField from '~/components/revenue/policy/RevenueNumberField.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Label } from '~/components/ui/label'
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { useRevenueHealth } from '~/composables/useRevenueHealth'
import { useRevenueSettings } from '~/composables/useRevenueSettings'

/** Objective basis default and graduated autonomy (§2.2, §23.3). */
const store = useRevenueSettings()
const { basis } = useRevenueHealth()
const settings = computed(() => store.settings.value)
const autonomy = computed(() => settings.value.autonomy)

function setBasis(value: ObjectiveBasis) {
  store.setDefaultBasis(value)
  // The dashboard opens on the default; switch the live lens too.
  basis.value = value
  toast.success(`Default basis: ${basisLabels[value].toLowerCase()}`)
}

const bandIssue = computed(() => autonomy.value.startBandPct > autonomy.value.maxBandPct
  ? 'The starting band cannot be wider than the ceiling.'
  : null)

function roomName(key: string) {
  return store.rooms.value.find(r => r.key === key)?.name ?? 'Removed room'
}

function scopeLabel(rule: AutonomyRule) {
  return rule.scope.kind === 'tag' ? `Tag: ${rule.scope.tag}` : roomName(rule.scope.roomKey)
}

// ── Rule dialog ──────────────────────────────────────────────────────
const dialogOpen = ref(false)
const editingId = ref<string | null>(null)
const form = ref({ kind: 'tag' as 'tag' | 'room', tag: '', roomKey: '', mode: 'review' as AutonomyMode, maxBandPct: null as number | null })

const formValid = computed(() => form.value.kind === 'tag' ? !!form.value.tag : !!form.value.roomKey)

function openRule(rule?: AutonomyRule) {
  editingId.value = rule?.id ?? null
  form.value = {
    kind: rule?.scope.kind ?? 'tag',
    tag: rule?.scope.kind === 'tag' ? rule.scope.tag : '',
    roomKey: rule?.scope.kind === 'room' ? rule.scope.roomKey : '',
    mode: rule?.mode ?? 'review',
    maxBandPct: rule?.maxBandPct ?? null,
  }
  dialogOpen.value = true
}

function saveRule() {
  if (!formValid.value)
    return
  store.saveAutonomyRule({
    id: editingId.value ?? newId('aut'),
    scope: form.value.kind === 'tag' ? { kind: 'tag', tag: form.value.tag } : { kind: 'room', roomKey: form.value.roomKey },
    mode: form.value.mode,
    maxBandPct: form.value.mode === 'graduated' ? form.value.maxBandPct : null,
  })
  dialogOpen.value = false
  toast.success(editingId.value ? 'Rule updated' : 'Rule added')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Objective basis -->
    <Card class="gap-4 p-5" data-testid="engine-basis">
      <div>
        <h3 class="text-sm font-semibold">
          Objective basis
        </h3>
        <p class="mt-0.5 text-xs text-muted-foreground">
          How Listing Health ranks and values findings when it opens. A room with an owner contract still follows its contract.
        </p>
      </div>
      <RadioGroup :model-value="settings.defaultBasis" class="grid gap-3 sm:grid-cols-2" @update:model-value="setBasis($event as ObjectiveBasis)">
        <Label
          v-for="(label, value) in basisLabels"
          :key="value"
          :for="`basis-${value}`"
          class="flex cursor-pointer items-start gap-3 rounded-md border p-3 font-normal"
          :class="settings.defaultBasis === value ? 'border-primary bg-primary/5' : ''"
        >
          <RadioGroupItem :id="`basis-${value}`" :value="value" class="mt-0.5" />
          <div>
            <p class="text-sm font-medium">{{ label }}</p>
            <p class="text-xs text-muted-foreground">
              {{ value === 'revenue' ? 'Rank by the money a change brings in.' : 'Rank by what is left after cleaning, commission and other room costs.' }}
            </p>
          </div>
        </Label>
      </RadioGroup>
    </Card>

    <!-- Autonomy defaults -->
    <Card class="gap-4 p-5" data-testid="engine-autonomy">
      <div>
        <h3 class="text-sm font-semibold">
          Autonomy
        </h3>
        <p class="mt-0.5 text-xs text-muted-foreground">
          A room earns the right to auto-apply. It starts with a narrow band and widens as its recommendations prove right; a revert narrows it again.
        </p>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div class="flex flex-col gap-1.5">
          <Label>Default for every room</Label>
          <Select :model-value="autonomy.mode" @update:model-value="store.patchAutonomy({ mode: $event as AutonomyMode })">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="(label, mode) in autonomyModeLabels" :key="mode" :value="mode">
                {{ label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label>Starting band</Label>
          <RevenueNumberField :model-value="autonomy.startBandPct" suffix="%" :min="0" :max="50" :invalid="!!bandIssue" aria-label="Starting band" @update:model-value="store.patchAutonomy({ startBandPct: $event ?? 0 })" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label>Ceiling</Label>
          <RevenueNumberField :model-value="autonomy.maxBandPct" suffix="%" :min="0" :max="50" :invalid="!!bandIssue" aria-label="Ceiling" @update:model-value="store.patchAutonomy({ maxBandPct: $event ?? 0 })" />
        </div>
      </div>
      <p v-if="bandIssue" class="text-xs text-destructive">
        {{ bandIssue }}
      </p>

      <div class="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        <Icon name="lucide:lock" class="mt-0.5 size-3.5 shrink-0" />
        <p>
          At every level: the room's minimum and maximum price hold, blackout dates never auto-apply, a manual date override is never touched, and holdout rooms are never written to.
        </p>
      </div>
    </Card>

    <!-- Rules -->
    <Card class="gap-4 p-5" data-testid="engine-rules">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold">
            Rules for tags and rooms
          </h3>
          <p class="mt-0.5 text-xs text-muted-foreground">
            A room rule beats a tag rule. When a room has several tagged rules, the stricter one wins.
          </p>
        </div>
        <Button size="sm" variant="outline" class="gap-1.5" @click="openRule()">
          <Icon name="lucide:plus" class="size-3.5" />
          Add rule
        </Button>
      </div>

      <ul v-if="autonomy.rules.length" class="divide-y rounded-md border">
        <li v-for="rule in autonomy.rules" :key="rule.id" class="flex flex-wrap items-center gap-3 px-3 py-2.5">
          <Icon :name="rule.scope.kind === 'tag' ? 'lucide:tag' : 'lucide:door-open'" class="size-4 text-muted-foreground" />
          <span class="min-w-0 flex-1 truncate text-sm">{{ scopeLabel(rule) }}</span>
          <Badge :variant="rule.mode === 'review' ? 'secondary' : 'outline'" class="text-[11px] font-normal">
            {{ rule.mode === 'review' ? 'Review every change' : `Auto-apply up to ±${rule.maxBandPct ?? autonomy.maxBandPct}%` }}
          </Badge>
          <Button size="icon" variant="ghost" class="size-8" :aria-label="`Edit rule for ${scopeLabel(rule)}`" @click="openRule(rule)">
            <Icon name="lucide:pencil" class="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" class="size-8" :aria-label="`Remove rule for ${scopeLabel(rule)}`" @click="store.removeAutonomyRule(rule.id)">
            <Icon name="lucide:trash-2" class="size-3.5" />
          </Button>
        </li>
      </ul>
      <p v-else class="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
        Every room follows the default.
      </p>
    </Card>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ editingId ? 'Edit rule' : 'Add rule' }}</DialogTitle>
          <DialogDescription>Set how far the engine may go on its own for a tag or one room.</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <Label>Applies to</Label>
            <div class="flex gap-2">
              <Select v-model="form.kind">
                <SelectTrigger class="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tag">
                    Tag
                  </SelectItem>
                  <SelectItem value="room">
                    Room
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select v-if="form.kind === 'tag'" v-model="form.tag">
                <SelectTrigger class="min-w-0 flex-1" aria-label="Tag">
                  <SelectValue placeholder="Pick a tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="tag in allTags" :key="tag" :value="tag">
                    {{ tag }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select v-else v-model="form.roomKey">
                <SelectTrigger class="min-w-0 flex-1" aria-label="Room">
                  <SelectValue placeholder="Pick a room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="room in store.rooms.value" :key="room.key" :value="room.key">
                    {{ room.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <Label>Mode</Label>
            <Select v-model="form.mode">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="(label, mode) in autonomyModeLabels" :key="mode" :value="mode">
                  {{ label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div v-if="form.mode === 'graduated'" class="flex flex-col gap-1.5">
            <Label>Ceiling</Label>
            <RevenueNumberField v-model="form.maxBandPct" suffix="%" :min="0" :max="autonomy.maxBandPct" nullable :placeholder="`${autonomy.maxBandPct} (default)`" aria-label="Rule ceiling" />
            <p class="text-xs text-muted-foreground">
              Never wider than the tenant ceiling of {{ autonomy.maxBandPct }}%.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="dialogOpen = false">
            Cancel
          </Button>
          <Button :disabled="!formValid" @click="saveRule">
            {{ editingId ? 'Save' : 'Add rule' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
