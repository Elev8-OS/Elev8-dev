<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Icon } from '#components'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Switch } from '~/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import type { BannerKind, BannerSeverity, BannerTargetFilter, MaintenanceImpact, MaintenanceWindow } from './data/banners'
import { MAINTENANCE_MODULES, MAINTENANCE_WRAP_UP_MS, MAINTENANCE_IMPACT_LABEL } from './data/banners'
import type { StaffRoleName } from './data/staff'
import { usePlatformBanners } from '~/composables/usePlatformBanners'
import { useStaffAuth } from '~/composables/useStaffAuth'
import { useTenants } from '~/composables/useTenants'
import { BANNER_TIMEZONES, formatInstant, zonedToInstant } from '~/lib/platform-banner-time'
import { cn } from '@/lib/utils'

const emit = defineEmits<{ published: [] }>()

const step = ref(1)

const kind = ref<BannerKind>('announcement')
const title = ref('')
const body = ref('')
const severity = ref<BannerSeverity>('info')
const sendEmail = ref(false)
const ctaLabel = ref('')
const ctaUrl = ref('')
const dismissible = ref(true)
const targetFilter = ref<BannerTargetFilter>({ scope: 'all' })
const visibleRoles = ref<StaffRoleName[]>(['Admin', 'General Manager', 'Finance/HR'])

// Schedule. Every date and time below is read in `timezone`.
const timezone = ref('UTC')
const showMode = ref<'now' | 'later'>('now')
const showDate = ref<string | null>(null)
const showTime = ref('09:00')
const autoExpire = ref(true)
const expireDate = ref<string | null>(null)
const expireTime = ref('18:00')

// Maintenance window.
const winStartDate = ref<string | null>(null)
const winStartTime = ref('02:00')
const winEndDate = ref<string | null>(null)
const winEndTime = ref('02:30')
const impact = ref<MaintenanceImpact>('offline')
const affected = ref<string[]>([])

const todayKey = ref<string | undefined>(undefined)
onMounted(() => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  todayKey.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})

const { can } = useStaffAuth()
const { createBanner, resolveRecipients } = usePlatformBanners()
const { byId: tenantById } = useTenants()

if (!can('compose_banner')) {
  throw createError({ statusCode: 403, statusMessage: 'Admin role required to compose banners' })
}

const isMaintenance = computed(() => kind.value === 'maintenance')

watch(kind, (k) => {
  if (k === 'maintenance' && severity.value === 'info') severity.value = 'warning'
})
// Changing severity resets the email switch to that severity's default.
watch(severity, (s) => {
  sendEmail.value = s === 'critical'
})
watch(winStartDate, (d) => {
  if (d && (!winEndDate.value || winEndDate.value < d)) winEndDate.value = d
})

const titleOk = computed(() => title.value.length > 0 && title.value.length <= 60)
const bodyOk = computed(() => body.value.length > 0 && body.value.length <= 200)
const step1Valid = computed(() => titleOk.value && bodyOk.value)

const matchedIds = computed(() => {
  const mock = { id: 'preview', targetFilter: targetFilter.value } as any
  return resolveRecipients(mock)
})
const step2Valid = computed(() => matchedIds.value.length > 0)

const matchedTenants = computed(() => matchedIds.value
  .map(id => tenantById(id))
  .filter(Boolean) as any[])

const showAtIso = computed(() => showMode.value === 'later' ? zonedToInstant(showDate.value, showTime.value, timezone.value) : null)
const windowStartIso = computed(() => zonedToInstant(winStartDate.value, winStartTime.value, timezone.value))
const windowEndIso = computed(() => zonedToInstant(winEndDate.value, winEndTime.value, timezone.value))
const expireIso = computed(() => zonedToInstant(expireDate.value, expireTime.value, timezone.value))

const maintenanceWindow = computed<MaintenanceWindow | undefined>(() => {
  if (!isMaintenance.value || !windowStartIso.value || !windowEndIso.value) return undefined
  return {
    startAt: windowStartIso.value,
    endAt: windowEndIso.value,
    timezone: timezone.value,
    impact: impact.value,
    affected: affected.value,
  }
})

// "Now" is a ref so validation can be refreshed: a bare `Date.now()` never triggers a recompute,
// and staff can leave the preview open until a chosen time has passed.
const clock = ref(Date.now())
const scheduleError = computed<string | null>(() => {
  const now = clock.value
  let appearsAt = now
  if (showMode.value === 'later') {
    if (!showAtIso.value) return 'Pick the date and time the banner should appear.'
    appearsAt = new Date(showAtIso.value).getTime()
    if (appearsAt <= now) return 'The banner must appear in the future. Choose "Publish now" for an immediate one.'
  }
  if (isMaintenance.value) {
    if (!windowStartIso.value || !windowEndIso.value) return 'Set when the maintenance window starts and ends.'
    const ws = new Date(windowStartIso.value).getTime()
    const we = new Date(windowEndIso.value).getTime()
    if (we <= ws) return 'The window must end after it starts.'
    if (ws <= now) return 'The window must start in the future. For something already happening, publish an announcement instead.'
    if (appearsAt > ws) return 'The banner must appear before the window starts.'
    if (!affected.value.length) return 'Pick at least one affected area.'
    return null
  }
  if (autoExpire.value) {
    if (!expireIso.value) return 'Pick when the banner expires, or turn auto-expire off.'
    if (new Date(expireIso.value).getTime() <= appearsAt) return 'The banner must expire after it appears.'
  }
  return null
})
const step3Valid = computed(() => scheduleError.value === null)

const previewBanner = computed(() => ({
  id: 'preview',
  title: title.value || 'Your title appears here',
  body: body.value || 'Your message appears here.',
  severity: severity.value,
  ctaLabel: ctaLabel.value || undefined,
  ctaUrl: ctaUrl.value || undefined,
  dismissible: dismissible.value,
  visibleRoles: visibleRoles.value,
  kind: kind.value,
  maintenance: maintenanceWindow.value,
  startAt: showAtIso.value ?? new Date().toISOString(),
} as any))

const STEPS = [
  { n: 1, label: 'Message' },
  { n: 2, label: 'Audience' },
  { n: 3, label: 'Schedule' },
  { n: 4, label: 'Review' },
]
const STEP_COPY: Record<number, { title: string, description: string }> = {
  1: { title: 'Write the message', description: 'Short and specific. Tenants read it at the top of their dashboard.' },
  2: { title: 'Choose who sees it', description: 'Pick tenants, then the roles inside each tenant that should see it.' },
  3: { title: 'Set the timing', description: 'Show it now or schedule it. Maintenance also needs a window.' },
  4: { title: 'Review and send', description: 'Check the preview on the right, then publish.' },
}

const reviewRows = computed(() => {
  const rows: { label: string, value: string }[] = [
    { label: 'Type', value: isMaintenance.value ? 'Maintenance' : 'Announcement' },
    { label: 'Severity', value: severity.value.charAt(0).toUpperCase() + severity.value.slice(1) },
    { label: 'Appears', value: showAtIso.value ? formatInstant(showAtIso.value, timezone.value) : 'Immediately' },
  ]
  if (isMaintenance.value && maintenanceWindow.value) {
    rows.push(
      { label: 'Window', value: `${formatInstant(maintenanceWindow.value.startAt, timezone.value)} to ${formatInstant(maintenanceWindow.value.endAt, timezone.value)}` },
      { label: 'Affected', value: maintenanceWindow.value.affected.join(', ') },
    )
  }
  else if (autoExpire.value && expireIso.value) {
    rows.push({ label: 'Expires', value: formatInstant(expireIso.value, timezone.value) })
  }
  const names = matchedTenants.value.slice(0, 3).map(t => t.name).join(', ')
  const more = matchedTenants.value.length - 3
  rows.push(
    { label: 'Tenants', value: `${matchedTenants.value.length}${names ? `: ${names}${more > 0 ? ` and ${more} more` : ''}` : ''}` },
    { label: 'Roles', value: visibleRoles.value.join(', ') || 'None' },
    { label: 'Dismissible', value: dismissible.value ? 'Yes' : 'No' },
  )
  return rows
})

function goToStep(n: number) {
  if (n < step.value) step.value = n
}

const emailRecipientCount = computed(() => matchedTenants.value.length * visibleRoles.value.length)

function toggleArea(area: string) {
  affected.value = affected.value.includes(area)
    ? affected.value.filter(a => a !== area)
    : [...affected.value, area]
}

function publish() {
  clock.value = Date.now()
  if (scheduleError.value) {
    toast.error(scheduleError.value)
    step.value = 3
    return
  }
  const startAt = showAtIso.value ?? new Date().toISOString()
  let endAt: string | undefined
  if (isMaintenance.value && maintenanceWindow.value) {
    endAt = new Date(new Date(maintenanceWindow.value.endAt).getTime() + MAINTENANCE_WRAP_UP_MS).toISOString()
  }
  else if (autoExpire.value && expireIso.value) {
    endAt = expireIso.value
  }
  try {
    createBanner({
      title: title.value,
      body: body.value,
      severity: severity.value,
      ctaLabel: ctaLabel.value || undefined,
      ctaUrl: ctaUrl.value || undefined,
      targetScope: targetFilter.value.scope,
      targetFilter: targetFilter.value,
      visibleRoles: visibleRoles.value,
      dismissible: dismissible.value,
      dismissalScope: 'account',
      kind: kind.value,
      maintenance: maintenanceWindow.value,
      sendEmail: sendEmail.value,
      startAt,
      endAt,
      createdByStaffId: 'staff-1',
    })
  }
  catch (e: any) {
    toast.error(e.message ?? 'Could not publish')
    return
  }
  toast.success(showMode.value === 'later'
    ? `Banner scheduled for ${formatInstant(startAt, timezone.value)}`
    : 'Banner published')
  emit('published')
}

function next() {
  clock.value = Date.now()
  if (step.value === 1 && !step1Valid.value) return
  if (step.value === 2 && !step2Valid.value) return
  if (step.value === 3 && !step3Valid.value) return
  step.value++
}
function back() {
  if (step.value > 1) step.value--
}
</script>

<template>
  <div class="space-y-4">
    <ol class="flex items-center gap-2" aria-label="Progress">
      <li v-for="(s, i) in STEPS" :key="s.n" class="flex flex-1 items-center gap-2 last:flex-none">
        <button
          type="button"
          class="flex items-center gap-2 rounded-md py-1 pr-1 text-left disabled:cursor-default"
          :disabled="s.n >= step"
          :aria-current="s.n === step ? 'step' : undefined"
          :data-testid="`step-${s.n}`"
          @click="goToStep(s.n)"
        >
          <span
            :class="cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
              s.n < step && 'border-primary bg-primary text-primary-foreground',
              s.n === step && 'border-primary text-primary ring-2 ring-primary/20',
              s.n > step && 'text-muted-foreground',
            )"
          >
            <Icon v-if="s.n < step" name="lucide:check" class="size-3.5" />
            <template v-else>{{ s.n }}</template>
          </span>
          <span :class="cn('hidden text-sm sm:inline', s.n === step ? 'font-semibold' : 'text-muted-foreground')">{{ s.label }}</span>
        </button>
        <div v-if="i < STEPS.length - 1" class="h-px flex-1 bg-border" />
      </li>
    </ol>

    <div class="grid gap-4 xl:grid-cols-3">
      <div class="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>{{ STEP_COPY[step]!.title }}</CardTitle>
            <CardDescription>{{ STEP_COPY[step]!.description }}</CardDescription>
          </CardHeader>
          <CardContent class="space-y-5">
            <template v-if="step === 1">
              <div class="space-y-2">
                <Label>Type</Label>
                <div class="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    class="rounded-md border p-3 text-left"
                    :class="kind === 'announcement' ? 'border-primary ring-2 ring-primary/20' : 'hover:bg-muted'"
                    data-testid="kind-announcement"
                    @click="kind = 'announcement'"
                  >
                    <div class="flex items-center gap-2">
                      <Icon name="lucide:megaphone" class="size-4" />
                      <span class="text-sm font-medium">Announcement</span>
                    </div>
                    <p class="mt-1 text-xs text-muted-foreground">News, product updates, incidents.</p>
                  </button>
                  <button
                    type="button"
                    class="rounded-md border p-3 text-left"
                    :class="kind === 'maintenance' ? 'border-primary ring-2 ring-primary/20' : 'hover:bg-muted'"
                    data-testid="kind-maintenance"
                    @click="kind = 'maintenance'"
                  >
                    <div class="flex items-center gap-2">
                      <Icon name="lucide:wrench" class="size-4" />
                      <span class="text-sm font-medium">Maintenance</span>
                    </div>
                    <p class="mt-1 text-xs text-muted-foreground">A planned window. Tenants see it in their own timezone.</p>
                  </button>
                </div>
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <Label>Title</Label>
                  <span class="text-xs" :class="titleOk || !title.length ? 'text-muted-foreground' : 'text-destructive'">{{ title.length }} / 60</span>
                </div>
                <Input v-model="title" :maxlength="60" :placeholder="isMaintenance ? 'Planned maintenance: Inbox and Reviews' : 'Guest Guide templates are here'" />
              </div>
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <Label>Body</Label>
                  <span class="text-xs" :class="bodyOk || !body.length ? 'text-muted-foreground' : 'text-destructive'">{{ body.length }} / 200</span>
                </div>
                <Textarea v-model="body" :maxlength="200" :rows="3" :placeholder="isMaintenance ? 'Inbox and Reviews will be offline for about 30 minutes.' : 'Five pre-built templates are now in your Brand settings.'" />
              </div>

              <div class="space-y-2">
                <Label>Severity</Label>
                <div class="grid gap-2 sm:grid-cols-3">
                  <button
                    v-for="s in (['info', 'warning', 'critical'] as BannerSeverity[])"
                    :key="s"
                    type="button"
                    class="rounded-md border p-3 text-left"
                    :class="severity === s ? 'border-primary ring-2 ring-primary/20' : 'hover:bg-muted'"
                    @click="severity = s"
                  >
                    <div class="flex items-center gap-2">
                      <Icon
                        :name="s === 'critical' ? 'lucide:octagon-alert' : s === 'warning' ? 'lucide:triangle-alert' : 'lucide:info'"
                        class="size-4"
                        :class="s === 'critical' ? 'text-destructive' : s === 'warning' ? 'text-warning-foreground' : 'text-primary'"
                      />
                      <span class="text-sm font-medium capitalize">{{ s }}</span>
                    </div>
                    <p class="mt-1 text-xs text-muted-foreground">
                      {{ s === 'critical' ? 'Emails matching users by default' : 'In-app only by default' }}
                    </p>
                  </button>
                </div>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <div class="space-y-2">
                  <Label>Button label (optional)</Label>
                  <Input v-model="ctaLabel" placeholder="View status" />
                </div>
                <div class="space-y-2">
                  <Label>Button link (optional)</Label>
                  <Input v-model="ctaUrl" placeholder="https://status.elev8.io" />
                </div>
              </div>

              <div class="divide-y rounded-md border">
                <div class="flex items-start justify-between gap-4 p-3">
                  <div>
                    <Label>Dismissible</Label>
                    <p class="text-xs text-muted-foreground">Tenants can hide it. Posting an update brings it back once.</p>
                  </div>
                  <Switch :model-value="dismissible" @update:model-value="(v) => dismissible = v" />
                </div>
                <div class="flex items-start justify-between gap-4 p-3">
                  <div>
                    <Label>Also send by email</Label>
                    <p class="text-xs text-muted-foreground">Goes to the users who can see the banner, when it appears and with each update.</p>
                  </div>
                  <Switch :model-value="sendEmail" data-testid="send-email-switch" @update:model-value="(v) => sendEmail = v" />
                </div>
              </div>
            </template>

            <template v-if="step === 2">
              <PlatformConsoleBannerTargetingControl v-model="targetFilter" v-model:visible-roles="visibleRoles" />
            </template>

            <template v-if="step === 3">
              <div class="space-y-2">
                <Label>Timezone for the times below</Label>
                <Select :model-value="timezone" @update:model-value="(v) => timezone = String(v)">
                  <SelectTrigger class="w-72"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="z in BANNER_TIMEZONES" :key="z.id" :value="z.id">{{ z.label }}</SelectItem>
                  </SelectContent>
                </Select>
                <p class="text-xs text-muted-foreground">Tenants read every time in their own timezone, with UTC beside it.</p>
              </div>

              <div class="space-y-3">
                <Label>{{ isMaintenance ? 'Show the banner' : 'Publish' }}</Label>
                <RadioGroup :model-value="showMode" class="space-y-2" @update:model-value="(v) => showMode = v as 'now' | 'later'">
                  <div class="flex items-center gap-2">
                    <RadioGroupItem id="show-now" value="now" />
                    <Label for="show-now" class="font-normal">{{ isMaintenance ? 'Right away, as advance notice' : 'Publish now' }}</Label>
                  </div>
                  <div class="flex items-center gap-2">
                    <RadioGroupItem id="show-later" value="later" />
                    <Label for="show-later" class="font-normal">Schedule for later</Label>
                  </div>
                </RadioGroup>
                <div v-if="showMode === 'later'" class="grid max-w-md grid-cols-2 gap-3" data-testid="show-later-fields">
                  <BaseDatePicker v-model="showDate" :min="todayKey" placeholder="Date" />
                  <BaseTimePicker v-model="showTime" :step="15" :start-hour="0" :end-hour="24" />
                </div>
              </div>

              <div v-if="isMaintenance" class="space-y-4 rounded-md border p-4" data-testid="maintenance-fields">
                <div class="flex items-center gap-2">
                  <Icon name="lucide:wrench" class="size-4" />
                  <span class="text-sm font-semibold">Maintenance window</span>
                </div>
                <div class="grid gap-3 sm:grid-cols-2">
                  <div class="space-y-2">
                    <Label>Starts</Label>
                    <div class="grid grid-cols-2 gap-2">
                      <BaseDatePicker v-model="winStartDate" :min="todayKey" placeholder="Date" />
                      <BaseTimePicker v-model="winStartTime" :step="15" :start-hour="0" :end-hour="24" />
                    </div>
                  </div>
                  <div class="space-y-2">
                    <Label>Ends</Label>
                    <div class="grid grid-cols-2 gap-2">
                      <BaseDatePicker v-model="winEndDate" :min="winStartDate ?? todayKey" placeholder="Date" />
                      <BaseTimePicker v-model="winEndTime" :step="15" :start-hour="0" :end-hour="24" />
                    </div>
                  </div>
                </div>
                <div class="space-y-2">
                  <Label>Impact</Label>
                  <RadioGroup :model-value="impact" class="space-y-2" @update:model-value="(v) => impact = v as MaintenanceImpact">
                    <div v-for="i in (['offline', 'degraded'] as MaintenanceImpact[])" :key="i" class="flex items-center gap-2">
                      <RadioGroupItem :id="`impact-${i}`" :value="i" />
                      <Label :for="`impact-${i}`" class="font-normal">{{ MAINTENANCE_IMPACT_LABEL[i] }}</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div class="space-y-2">
                  <Label>Affected areas</Label>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="m in MAINTENANCE_MODULES"
                      :key="m"
                      type="button"
                      class="rounded-full border px-3 py-1 text-xs font-medium"
                      :class="affected.includes(m) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'"
                      :aria-pressed="affected.includes(m)"
                      @click="toggleArea(m)"
                    >
                      {{ m }}
                    </button>
                  </div>
                </div>
                <p class="text-xs text-muted-foreground">
                  The banner stays up until an hour after the window ends, or until you mark it resolved.
                </p>
              </div>

              <div v-else class="space-y-3">
                <div class="flex items-center gap-3">
                  <Switch :model-value="autoExpire" @update:model-value="(v) => autoExpire = v" />
                  <Label>Auto-expire</Label>
                </div>
                <div v-if="autoExpire" class="space-y-2">
                  <Label>Expires</Label>
                  <div class="grid max-w-md grid-cols-2 gap-3">
                    <BaseDatePicker v-model="expireDate" :min="showDate ?? todayKey" placeholder="Date" />
                    <BaseTimePicker v-model="expireTime" :step="15" :start-hour="0" :end-hour="24" />
                  </div>
                </div>
              </div>

              <p v-if="scheduleError" class="flex items-start gap-2 text-sm text-destructive" role="alert" data-testid="schedule-error">
                <Icon name="lucide:circle-alert" class="mt-0.5 size-4 shrink-0" />
                {{ scheduleError }}
              </p>
            </template>

            <template v-if="step === 4">
              <dl class="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2.5 text-sm" data-testid="review-summary">
                <template v-for="r in reviewRows" :key="r.label">
                  <dt class="text-muted-foreground">{{ r.label }}</dt>
                  <dd>{{ r.value }}</dd>
                </template>
              </dl>
              <div v-if="sendEmail" class="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm" data-testid="email-warning">
                <Icon name="lucide:mail" class="mt-0.5 size-4 shrink-0 text-destructive" />
                <span>An email will be sent to {{ emailRecipientCount }} matching {{ emailRecipientCount === 1 ? 'user' : 'users' }} when the banner appears.</span>
              </div>
            </template>
          </CardContent>
        </Card>

        <div class="flex items-center justify-between">
          <Button variant="outline" :disabled="step === 1" @click="back">← Back</Button>
          <Button v-if="step < 4" :disabled="(step === 1 && !step1Valid) || (step === 2 && !step2Valid) || (step === 3 && !step3Valid)" @click="next">
            Next →
          </Button>
          <Button v-else @click="publish">
            {{ showMode === 'later' ? 'Schedule banner' : 'Publish now' }}
          </Button>
        </div>
      </div>

      <aside class="xl:col-span-1">
        <div class="space-y-3 xl:sticky xl:top-4">
          <Card>
            <CardHeader>
              <CardTitle class="text-sm">Preview</CardTitle>
              <CardDescription>What tenants see at the top of their dashboard.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3">
              <PlatformConsoleBannerCard :banner="previewBanner" />
              <p class="text-xs text-muted-foreground">
                {{ matchedTenants.length }} {{ matchedTenants.length === 1 ? 'tenant' : 'tenants' }} will see this. Times show in each reader's timezone.
              </p>
            </CardContent>
          </Card>
        </div>
      </aside>
    </div>
  </div>
</template>
