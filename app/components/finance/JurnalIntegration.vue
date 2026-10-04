<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { jurnalAccounts, getAccountsByCategory, getExpenseAccounts } from '@/components/finance/data/jurnal'
import { useIntegrationAccounts, mappingTabs } from '@/composables/useIntegrationAccounts'
import { useJurnal } from '@/composables/useJurnal'
import { allListings, useListingMappings } from '@/composables/useListingMappings'

const {
  isConnected,
  apiKey,
  apiKeyInput,
  companyName,
  lastConnected,
  isTesting,
  isSaving,
  testConnection,
  saveApiKey,
  disconnect,
} = useJurnal()

const showDisconnectConfirm = ref(false)
const showApiKeyInput = ref(false)
const showConfigDialog = ref(false)
const activeTab = ref<string>('booking')

// ── Account mapping ────────────────────────────────────────────────────────
const { getDefaults, setBookingRevenueLine, setUpsellRevenueLine, setCostsLine, setCityTax } = useIntegrationAccounts()
const jurnalDefaults = computed(() => getDefaults('jurnal'))

// Validation
const validationErrors = ref<Record<string, string>>({})

function validateAccount(code: string, requiredPrefix: string, fieldKey: string): boolean {
  if (!code) {
    const { [fieldKey]: _, ...rest } = validationErrors.value
    validationErrors.value = rest
    return true
  }
  if (!code.startsWith(requiredPrefix)) {
    const prefixLabels: Record<string, string> = { '1': 'asset (1-xxx)', '2': 'liability (2-xxx)', '4': 'revenue (4-xxx)' }
    validationErrors.value = { ...validationErrors.value, [fieldKey]: `Must be a ${prefixLabels[requiredPrefix]} account` }
    return false
  }
  const { [fieldKey]: _, ...rest } = validationErrors.value
  validationErrors.value = rest
  return true
}

const hasErrors = computed(() => Object.keys(validationErrors.value).length > 0)

// Account options by category
const allAccounts = computed(() => jurnalAccounts)
const assetAccounts = computed(() => getAccountsByCategory('asset'))
const liabilityAccounts = computed(() => getAccountsByCategory('liability'))
const revenueAccounts = computed(() => getAccountsByCategory('revenue'))
const expenseAccounts = computed(() => getExpenseAccounts())

// ── Property tag mapping ───────────────────────────────────────────────────
const { setMapping, clearMapping, getMappingFor } = useListingMappings()
const tagSearch = ref('')
const selectedTagFilters = ref<string[]>([])
const tagPickerOpen = ref(false)
const tagInputFocused = ref<string | null>(null)
const tagInputValue = ref('')

const jurnalMappedCount = computed(() =>
  allListings.filter(l => getMappingFor(l.name)?.integration === 'jurnal').length,
)

// All unique cities for tag filtering
const allCityTags = computed(() => {
  const cities = new Set<string>()
  allListings.forEach(l => cities.add(l.city))
  return [...Array.from(cities).sort()]
})

// All unique tags currently in use
const allUsedTags = computed(() => {
  const tags = new Set<string>()
  allListings.forEach(l => {
    const m = getMappingFor(l.name)
    if (m?.integration === 'jurnal' && m.tag) {
      tags.add(m.tag)
    }
  })
  return [...Array.from(tags).sort()]
})

// ── OTA Channel tags ───────────────────────────────────────────────────────
const channelTagSearch = ref('')
const channelTagPickerOpen = ref(false)
const channelTagInputFocused = ref<string | null>(null)
const channelTagInputValue = ref('')

const otaChannels = ['Airbnb', 'Booking.com', 'Direct', 'Expedia', 'Agoda', 'VRBO', 'Google Travel']

const { getMappingFor: getChannelMapping, setMapping: setChannelMapping, clearMapping: clearChannelMapping } = useListingMappings()
const channelTagState = useState<Record<string, string>>('jurnal-channel-tags', () => ({}))

function getChannelTag(channel: string): string {
  return channelTagState.value[channel] || ''
}

function setChannelTag(channel: string, tag: string) {
  channelTagState.value = { ...channelTagState.value, [channel]: tag }
}

function removeChannelTag(channel: string) {
  const updated = { ...channelTagState.value }
  delete updated[channel]
  channelTagState.value = updated
}

const allUsedChannelTags = computed(() => {
  return [...new Set(Object.values(channelTagState.value).filter(Boolean))].sort()
})

const channelTagSuggestions = computed(() => {
  if (!channelTagInputValue.value.trim()) return allUsedChannelTags.value
  const q = channelTagInputValue.value.toLowerCase()
  return allUsedChannelTags.value.filter(t => t.toLowerCase().includes(q))
})

function handleChannelTagInput(channel: string, value: string) {
  channelTagInputValue.value = value
}

function handleChannelTagSelect(channel: string, tag: string) {
  setChannelTag(channel, tag)
  channelTagInputFocused.value = null
}

function handleChannelTagEnter(channel: string) {
  if (channelTagInputValue.value.trim()) {
    setChannelTag(channel, channelTagInputValue.value.trim())
    channelTagInputFocused.value = null
  }
}

const jurnalChannelMappedCount = computed(() =>
  otaChannels.filter(c => !!channelTagState.value[c]).length
)

// ── Upsell tags ────────────────────────────────────────────────────────────
const upsellTagInputFocused = ref<string | null>(null)
const upsellTagInputValue = ref('')

const upsellCategories = [
  'Airport Transport',
  'Private Chef',
  'Spa',
  'Activity',
  'Vehicle Rental',
  'Early Check-in',
  'Late Check-out',
  'Mid-stay Cleaning',
  'Office Equipment',
  'Baby',
  'Pet',
  'Miscellaneous',
]

const upsellTagState = useState<Record<string, string>>('jurnal-upsell-tags', () => ({}))

function getUpsellTag(category: string): string {
  return upsellTagState.value[category] || ''
}

function setUpsellTag(category: string, tag: string) {
  upsellTagState.value = { ...upsellTagState.value, [category]: tag }
}

function removeUpsellTag(category: string) {
  const updated = { ...upsellTagState.value }
  delete updated[category]
  upsellTagState.value = updated
}

const allUsedUpsellTags = computed(() => {
  return [...new Set(Object.values(upsellTagState.value).filter(Boolean))].sort()
})

const upsellTagSuggestions = computed(() => {
  if (!upsellTagInputValue.value.trim()) return allUsedUpsellTags.value
  const q = upsellTagInputValue.value.toLowerCase()
  return allUsedUpsellTags.value.filter(t => t.toLowerCase().includes(q))
})

function handleUpsellTagInput(category: string, value: string) {
  upsellTagInputValue.value = value
}

function handleUpsellTagSelect(category: string, tag: string) {
  setUpsellTag(category, tag)
  upsellTagInputFocused.value = null
}

function handleUpsellTagEnter(category: string) {
  if (upsellTagInputValue.value.trim()) {
    setUpsellTag(category, upsellTagInputValue.value.trim())
    upsellTagInputFocused.value = null
  }
}

const jurnalUpsellMappedCount = computed(() =>
  upsellCategories.filter(c => !!upsellTagState.value[c]).length
)

// ── Cost tags ──────────────────────────────────────────────────────────────
const costTagInputFocused = ref<string | null>(null)
const costTagInputValue = ref('')

const costCategories = [
  'Activity',
  'Cleaning Cost',
  'Manual Cost',
  'Task',
]

const costTagState = useState<Record<string, string>>('jurnal-cost-tags', () => ({}))

function getCostTag(category: string): string {
  return costTagState.value[category] || ''
}

function setCostTag(category: string, tag: string) {
  costTagState.value = { ...costTagState.value, [category]: tag }
}

function removeCostTag(category: string) {
  const updated = { ...costTagState.value }
  delete updated[category]
  costTagState.value = updated
}

const allUsedCostTags = computed(() => {
  return [...new Set(Object.values(costTagState.value).filter(Boolean))].sort()
})

const costTagSuggestions = computed(() => {
  if (!costTagInputValue.value.trim()) return allUsedCostTags.value
  const q = costTagInputValue.value.toLowerCase()
  return allUsedCostTags.value.filter(t => t.toLowerCase().includes(q))
})

function handleCostTagInput(category: string, value: string) {
  costTagInputValue.value = value
}

function handleCostTagSelect(category: string, tag: string) {
  setCostTag(category, tag)
  costTagInputFocused.value = null
}

function handleCostTagEnter(category: string) {
  if (costTagInputValue.value.trim()) {
    setCostTag(category, costTagInputValue.value.trim())
    costTagInputFocused.value = null
  }
}

const jurnalCostMappedCount = computed(() =>
  costCategories.filter(c => !!costTagState.value[c]).length
)

// Autocomplete suggestions
const tagSuggestions = computed(() => {
  if (!tagInputValue.value.trim()) return allUsedTags.value
  const q = tagInputValue.value.toLowerCase()
  return allUsedTags.value.filter(t => t.toLowerCase().includes(q))
})

function isMappedToBexio(listingName: string): boolean {
  return getMappingFor(listingName)?.integration === 'bexio'
}

function getMappingTag(listingName: string): string {
  const m = getMappingFor(listingName)
  return m?.integration === 'jurnal' ? m.tag : ''
}

function addTag(listingName: string, tag: string) {
  setMapping(listingName, 'jurnal', tag)
  tagInputValue.value = ''
}

function removeTag(listingName: string) {
  clearMapping(listingName)
}

function handleTagInput(listingName: string, value: string) {
  tagInputValue.value = value
}

function handleTagSelect(listingName: string, tag: string) {
  addTag(listingName, tag)
  tagInputFocused.value = null
}

function handleTagEnter(listingName: string) {
  if (tagInputValue.value.trim()) {
    addTag(listingName, tagInputValue.value.trim())
    tagInputFocused.value = null
  }
}

function toggleCityTag(city: string) {
  const idx = selectedTagFilters.value.indexOf(city)
  if (idx === -1) selectedTagFilters.value.push(city)
  else selectedTagFilters.value.splice(idx, 1)
}

const filteredTagListings = computed(() => {
  let list = allListings
  if (selectedTagFilters.value.length > 0) {
    list = list.filter(l => selectedTagFilters.value.includes(l.city))
  }
  const q = tagSearch.value.toLowerCase().trim()
  if (q) {
    list = list.filter(l =>
      l.name.toLowerCase().includes(q) ||
      getMappingTag(l.name).toLowerCase().includes(q) ||
      l.city.toLowerCase().includes(q)
    )
  }
  return list
})

// ── Handlers ───────────────────────────────────────────────────────────────
function openConfig() {
  showConfigDialog.value = true
}

function handleSave() {
  // Validate tax fields - get account code from ID
  const getAccountCode = (id: string) => jurnalAccounts.find(a => a.id === id)?.code || ''
  validateAccount(getAccountCode(jurnalDefaults.value.cityTax.taxCollected), '2', 'taxCollected')
  validateAccount(getAccountCode(jurnalDefaults.value.cityTax.taxRemitted), '2', 'taxRemitted')

  if (hasErrors.value) {
    toast.error('Please fix validation errors before saving.')
    return
  }

  showConfigDialog.value = false
  toast.success('Mapping saved. Jurnal sync is active.')
}

async function handleTestConnection() {
  const ok = await testConnection()
  if (ok)
    toast.success('Connection successful — Jurnal API responded.')
  else toast.error('Connection failed. Check your API key.')
}

async function handleSaveApiKey() {
  if (!apiKeyInput.value.trim()) {
    toast.error('API key cannot be empty.')
    return
  }
  await saveApiKey()
  showApiKeyInput.value = false
  toast.success('API key saved. Connected to Mekari Jurnal.')
  showConfigDialog.value = true
}

function handleDisconnect() {
  disconnect()
  showDisconnectConfirm.value = false
  toast.success('Disconnected from Mekari Jurnal.')
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Connection card -->
    <div class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-5 py-3.5">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
            <FinanceJurnalLogo class="h-5 w-auto" />
          </div>
          <div>
            <p class="text-sm font-medium">Mekari Jurnal</p>
            <p class="text-xs text-muted-foreground">Accounting & ledger integration</p>
          </div>
        </div>
        <span
          class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          :class="isConnected ? 'text-green-700 bg-green-50' : 'text-slate-600 bg-slate-100'"
        >
          <span class="h-1.5 w-1.5 rounded-full" :class="isConnected ? 'bg-green-500' : 'bg-slate-400'" />
          {{ isConnected ? 'Connected' : 'Not connected' }}
        </span>
      </div>

      <div class="p-5">
        <template v-if="isConnected">
          <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt class="text-xs text-muted-foreground">Company</dt>
              <dd class="mt-0.5 font-medium">{{ companyName }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">API Key</dt>
              <dd class="mt-0.5 font-mono text-sm">{{ apiKey }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">Connected since</dt>
              <dd class="mt-0.5 font-medium">{{ lastConnected }}</dd>
            </div>
          </dl>
          <div class="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" @click="openConfig">
              <Icon name="i-lucide-settings-2" class="mr-2 h-3.5 w-3.5" />
              Account & Tag Mapping
            </Button>
            <Button variant="ghost" size="sm" class="text-destructive hover:text-destructive" @click="showDisconnectConfirm = true">
              <Icon name="i-lucide-unlink" class="mr-2 h-3.5 w-3.5" />
              Disconnect
            </Button>
          </div>
        </template>

        <template v-else>
          <p class="mb-4 text-sm text-muted-foreground">
            Connect your Mekari Jurnal account to push cost and revenue entries directly into your accounting ledger.
          </p>
          <Button size="sm" @click="showApiKeyInput = true">
            <Icon name="i-lucide-plug" class="mr-2 h-3.5 w-3.5" />
            Connect Mekari Jurnal
          </Button>
        </template>

        <div v-if="showApiKeyInput" class="mt-4 flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
          <div>
            <label class="mb-1.5 block text-sm font-medium">API Key</label>
            <p class="mb-2 text-xs text-muted-foreground">Found in Mekari Jurnal → Settings → API Access.</p>
            <Input v-model="apiKeyInput" type="password" placeholder="sk-jurnal-..." class="font-mono" @keydown.enter="handleSaveApiKey" />
          </div>
          <div class="flex gap-2">
            <Button size="sm" :disabled="isSaving" @click="handleSaveApiKey">
              <Icon v-if="isSaving" name="i-lucide-loader-2" class="mr-2 h-3.5 w-3.5 animate-spin" />
              {{ isSaving ? 'Saving…' : 'Save & Connect' }}
            </Button>
            <Button variant="ghost" size="sm" @click="showApiKeyInput = false; apiKeyInput = ''">Cancel</Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Config dialog -->
    <Dialog :open="showConfigDialog" @update:open="showConfigDialog = $event">
      <DialogContent class="!max-w-4xl">
        <DialogHeader>
          <DialogTitle>Jurnal Account & Tag Mapping</DialogTitle>
          <DialogDescription>
            Map Elev8 transaction types to your Jurnal chart of accounts
          </DialogDescription>
        </DialogHeader>

        <Tabs v-model="activeTab" class="w-full">
          <TabsList class="w-full justify-start">
            <TabsTrigger v-for="tab in mappingTabs" :key="tab.key" :value="tab.key" class="gap-1.5">
              <Icon :name="tab.icon" class="h-3.5 w-3.5" />
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>

          <!-- Booking Revenue -->
          <TabsContent value="booking" class="mt-4">
            <div class="flex flex-col gap-4">
              <p class="text-sm text-muted-foreground">
                Double-entry mapping for booking invoices. Each line item has a debit and credit account.
              </p>

              <div class="rounded-md border overflow-visible">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b bg-muted/40">
                      <th class="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[25%]">Line Item</th>
                      <th class="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[37.5%]">Debit Account</th>
                      <th class="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[37.5%]">Credit Account</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    <!-- Accommodation -->
                    <tr>
                      <td class="px-4 py-3">
                        <p class="font-medium">Accommodation</p>
                        <p class="text-xs text-muted-foreground">per reservation</p>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="jurnalDefaults.bookingRevenue.accommodation.debit" @update:model-value="val => setBookingRevenueLine('jurnal', 'accommodation', 'debit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">
                              {{ acc.code }} · {{ acc.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="jurnalDefaults.bookingRevenue.accommodation.credit" @update:model-value="val => setBookingRevenueLine('jurnal', 'accommodation', 'credit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">
                              {{ acc.code }} · {{ acc.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>

                    <!-- Platform Fee -->
                    <tr>
                      <td class="px-4 py-3">
                        <p class="font-medium">Platform Fee</p>
                        <p class="text-xs text-muted-foreground">Airbnb / Booking.com service fee</p>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="jurnalDefaults.bookingRevenue.platformFee.debit" @update:model-value="val => setBookingRevenueLine('jurnal', 'platformFee', 'debit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">
                              {{ acc.code }} · {{ acc.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="jurnalDefaults.bookingRevenue.platformFee.credit" @update:model-value="val => setBookingRevenueLine('jurnal', 'platformFee', 'credit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">
                              {{ acc.code }} · {{ acc.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>

                    <!-- Fee -->
                    <tr>
                      <td class="px-4 py-3">
                        <p class="font-medium">Fee</p>
                        <p class="text-xs text-muted-foreground">Elev8 service fee / commission</p>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="jurnalDefaults.bookingRevenue.fee.debit" @update:model-value="val => setBookingRevenueLine('jurnal', 'fee', 'debit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">
                              {{ acc.code }} · {{ acc.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="jurnalDefaults.bookingRevenue.fee.credit" @update:model-value="val => setBookingRevenueLine('jurnal', 'fee', 'credit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">
                              {{ acc.code }} · {{ acc.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>

                    <!-- Tax -->
                    <tr>
                      <td class="px-4 py-3">
                        <p class="font-medium">Tax</p>
                        <p class="text-xs text-muted-foreground">City tax / tourist tax</p>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="jurnalDefaults.bookingRevenue.tax.debit" @update:model-value="val => setBookingRevenueLine('jurnal', 'tax', 'debit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">
                              {{ acc.code }} · {{ acc.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="jurnalDefaults.bookingRevenue.tax.credit" @update:model-value="val => setBookingRevenueLine('jurnal', 'tax', 'credit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">
                              {{ acc.code }} · {{ acc.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <!-- Upsell Revenue -->
          <TabsContent value="upsell" class="mt-4">
            <div class="flex flex-col gap-4">
              <p class="text-sm text-muted-foreground">
                Upsell orders are always synced as separate invoices — never as line items on booking invoices.
              </p>

              <div class="rounded-md border overflow-visible">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b bg-muted/40">
                      <th class="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[25%]">Line Item</th>
                      <th class="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[37.5%]">Debit Account</th>
                      <th class="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[37.5%]">Credit Account</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    <tr>
                      <td class="px-4 py-3">
                        <p class="font-medium">Upsell Revenue</p>
                        <p class="text-xs text-muted-foreground">per upsell order</p>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="jurnalDefaults.upsellRevenue.default.debit" @update:model-value="val => setUpsellRevenueLine('jurnal', 'debit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">
                              {{ acc.code }} · {{ acc.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="jurnalDefaults.upsellRevenue.default.credit" @update:model-value="val => setUpsellRevenueLine('jurnal', 'credit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">
                              {{ acc.code }} · {{ acc.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <!-- Costs -->
          <TabsContent value="costs" class="mt-4">
            <div class="flex flex-col gap-4">
              <p class="text-sm text-muted-foreground">
                Default account for all operational costs. Cost types are handled via Cost Tags.
              </p>

              <div class="rounded-md border overflow-visible">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b bg-muted/40">
                      <th class="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[25%]">Line Item</th>
                      <th class="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[37.5%]">Debit Account</th>
                      <th class="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[37.5%]">Credit Account</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    <tr>
                      <td class="px-4 py-3">
                        <p class="font-medium">Operational Costs</p>
                        <p class="text-xs text-muted-foreground">all cost entries</p>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="jurnalDefaults.costs.default.debit" @update:model-value="val => setCostsLine('jurnal', 'debit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent><SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">{{ acc.code }} · {{ acc.name }}</SelectItem></SelectContent>
                        </Select>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="jurnalDefaults.costs.default.credit" @update:model-value="val => setCostsLine('jurnal', 'credit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent><SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">{{ acc.code }} · {{ acc.name }}</SelectItem></SelectContent>
                        </Select>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <!-- City Tax -->
          <TabsContent value="tax" class="mt-4">
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5 max-w-md">
                <label class="text-sm font-medium">Collection Mode</label>
                <p class="text-xs text-muted-foreground">Who collects city tax from guests?</p>
                <Select :model-value="jurnalDefaults.cityTax.collectionMode" @update:model-value="val => setCityTax('jurnal', 'collectionMode', val as string)">
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elev8">Collected by Elev8</SelectItem>
                    <SelectItem value="ota">Collected by OTA (e.g. Airbnb)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <template v-if="jurnalDefaults.cityTax.collectionMode === 'elev8'">
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-sm font-medium">Tax Collected</label>
                    <p class="text-xs text-muted-foreground">Liability account (2-xxx)</p>
                    <Select :model-value="jurnalDefaults.cityTax.taxCollected" @update:model-value="val => { setCityTax('jurnal', 'taxCollected', val as string); validateAccount(jurnalAccounts.find(a => a.id === val)?.code || '', '2', 'taxCollected') }">
                      <SelectTrigger class="w-full" :class="validationErrors.taxCollected && 'border-destructive'">
                        <SelectValue placeholder="Select account…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="acc in liabilityAccounts" :key="acc.id" :value="acc.id">
                          {{ acc.code }} – {{ acc.name }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p v-if="validationErrors.taxCollected" class="text-xs text-destructive">{{ validationErrors.taxCollected }}</p>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-sm font-medium">Tax Remitted</label>
                    <p class="text-xs text-muted-foreground">Liability account (2-xxx) — cleared when tax is paid to authorities</p>
                    <Select :model-value="jurnalDefaults.cityTax.taxRemitted" @update:model-value="val => { setCityTax('jurnal', 'taxRemitted', val as string); validateAccount(jurnalAccounts.find(a => a.id === val)?.code || '', '2', 'taxRemitted') }">
                      <SelectTrigger class="w-full" :class="validationErrors.taxRemitted && 'border-destructive'">
                        <SelectValue placeholder="Select account…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="acc in liabilityAccounts" :key="acc.id" :value="acc.id">
                          {{ acc.code }} – {{ acc.name }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p v-if="validationErrors.taxRemitted" class="text-xs text-destructive">{{ validationErrors.taxRemitted }}</p>
                  </div>
                </div>
              </template>

              <div v-else class="rounded-md border border-blue-200 bg-blue-50/50 p-3">
                <p class="text-xs text-blue-800">
                  <Icon name="i-lucide-info" class="mr-1 inline h-3.5 w-3.5" />
                  OTA handles collection and remittance. No Jurnal entry will be created for city tax on OTA bookings.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <!-- Property Tags -->
        <div class="mt-6 border-t pt-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div>
                <p class="text-sm font-medium">Property Tags</p>
                <p class="text-xs text-muted-foreground">Assign a Jurnal tag to each listing for tracking in reports</p>
              </div>
              <Badge variant="secondary" class="tabular-nums shrink-0">
                {{ jurnalMappedCount }}/{{ allListings.length }}
              </Badge>
            </div>
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="outline" size="sm" class="h-8 gap-1.5">
                  Assign tags
                  <Icon name="i-lucide-chevron-right" class="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-[560px] p-0" align="end" :side-offset="6">
                <!-- Search + Tag filter -->
                <div class="flex items-center gap-2 border-b px-3 py-2">
                  <div class="relative flex-1">
                    <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input v-model="tagSearch" class="h-7 pl-8 text-xs" placeholder="Search listings…" />
                    <button v-if="tagSearch" class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" @click="tagSearch = ''">
                      <Icon name="i-lucide-x" class="h-3 w-3" />
                    </button>
                  </div>
                  <Popover v-model:open="tagPickerOpen">
                    <PopoverTrigger as-child>
                      <Button variant="outline" class="h-7 shrink-0 gap-1 px-2 text-xs" :class="selectedTagFilters.length > 0 ? 'border-primary text-primary' : ''">
                        <Icon name="i-lucide-tag" class="h-3 w-3" />
                        <span v-if="selectedTagFilters.length > 0" class="font-semibold">{{ selectedTagFilters.length }}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent class="w-52 p-0" align="end" :side-offset="4">
                      <div class="p-1">
                        <button v-for="city in allCityTags" :key="city" class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted" @click="toggleCityTag(city)">
                          <div class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border" :class="selectedTagFilters.includes(city) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
                            <Icon v-if="selectedTagFilters.includes(city)" name="i-lucide-check" class="h-3 w-3" />
                          </div>
                          <span class="truncate text-sm">{{ city }}</span>
                        </button>
                      </div>
                      <div v-if="selectedTagFilters.length > 0" class="flex items-center justify-between border-t px-3 py-2">
                        <span class="text-xs text-muted-foreground">{{ selectedTagFilters.length }} selected</span>
                        <button class="text-xs text-muted-foreground hover:text-foreground" @click="selectedTagFilters = []">Clear</button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <!-- Active filter chips -->
                <div v-if="selectedTagFilters.length > 0" class="flex flex-wrap gap-1 border-b px-3 py-1.5">
                  <span v-for="tag in selectedTagFilters" :key="tag" class="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-foreground">
                    {{ tag }}
                    <button class="hover:text-destructive" @click="toggleCityTag(tag)">
                      <Icon name="i-lucide-x" class="h-2.5 w-2.5" />
                    </button>
                  </span>
                </div>

                <!-- Listing table -->
                <div class="max-h-[320px] overflow-y-auto">
                  <table class="w-full table-fixed text-sm">
                    <thead class="sticky top-0 bg-popover z-10">
                      <tr class="border-b">
                        <th class="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground w-[55%]">Listing</th>
                        <th class="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground w-[45%]">Tag</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y">
                      <tr v-for="listing in filteredTagListings" :key="listing.name" :class="isMappedToBexio(listing.name) ? 'opacity-50' : ''">
                        <td class="px-3 py-1.5 text-xs truncate" :title="listing.name">{{ listing.name }}</td>
                        <td class="px-3 py-1.5">
                          <div v-if="isMappedToBexio(listing.name)" class="text-[11px] text-muted-foreground">Bexio</div>
                          <div v-else class="relative">
                            <div class="flex h-7 w-full items-center gap-1 rounded border bg-transparent px-1.5 text-[11px]" :class="tagInputFocused === listing.name ? 'border-primary' : ''">
                              <!-- Badge inside field -->
                              <span v-if="getMappingTag(listing.name) && tagInputFocused !== listing.name" class="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground shrink-0">
                                {{ getMappingTag(listing.name) }}
                                <button class="hover:text-destructive" @click="removeTag(listing.name)">
                                  <Icon name="i-lucide-x" class="h-2.5 w-2.5" />
                                </button>
                              </span>
                              <!-- Input -->
                              <input
                                v-if="!getMappingTag(listing.name) || tagInputFocused === listing.name"
                                :value="tagInputFocused === listing.name ? tagInputValue : ''"
                                class="flex-1 bg-transparent outline-none placeholder:text-muted-foreground min-w-0 text-foreground"
                                placeholder="Add tag…"
                                @focus="tagInputFocused = listing.name; tagInputValue = ''"
                                @input="handleTagInput(listing.name, ($event.target as HTMLInputElement).value)"
                                @keydown.enter="handleTagEnter(listing.name)"
                                @keydown.escape="tagInputFocused = null"
                                @blur="tagInputFocused = null"
                              />
                            </div>
                            <!-- Suggestions dropdown -->
                            <div v-if="tagInputFocused === listing.name" class="absolute left-0 top-full z-20 mt-1 w-full rounded-md border bg-popover shadow-md">
                              <div class="p-1 max-h-32 overflow-y-auto">
                                <button
                                  v-for="suggestion in tagSuggestions"
                                  :key="suggestion"
                                  class="flex w-full items-center rounded-sm px-2 py-1 text-[11px] transition-colors hover:bg-muted"
                                  @mousedown.prevent="handleTagSelect(listing.name, suggestion)"
                                >
                                  {{ suggestion }}
                                </button>
                                <button
                                  v-if="tagInputValue.trim() && !allUsedTags.includes(tagInputValue.trim())"
                                  class="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-[11px] text-primary transition-colors hover:bg-muted"
                                  @mousedown.prevent="handleTagEnter(listing.name)"
                                >
                                  <Icon name="i-lucide-plus" class="h-3 w-3" />
                                  Create "{{ tagInputValue.trim() }}"
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div class="flex items-center justify-between border-t px-3 py-2">
                  <span class="text-[11px] text-muted-foreground">{{ filteredTagListings.length }} listings</span>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <!-- OTA Channel Tags -->
        <div class="mt-4 pt-4 border-t">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div>
                <p class="text-sm font-medium">OTA Channel Tags</p>
                <p class="text-xs text-muted-foreground">Assign a Jurnal tag per booking channel</p>
              </div>
              <Badge variant="secondary" class="tabular-nums shrink-0">
                {{ jurnalChannelMappedCount }}/{{ otaChannels.length }}
              </Badge>
            </div>
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="outline" size="sm" class="h-8 gap-1.5">
                  Assign tags
                  <Icon name="i-lucide-chevron-right" class="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-[400px] p-0" align="end" :side-offset="6">
                <div class="max-h-[280px] overflow-y-auto">
                  <table class="w-full table-fixed text-sm">
                    <thead class="sticky top-0 bg-popover z-10">
                      <tr class="border-b">
                        <th class="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground w-[40%]">Channel</th>
                        <th class="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground w-[60%]">Tag</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y">
                      <tr v-for="channel in otaChannels" :key="channel">
                        <td class="px-3 py-1.5 text-xs font-medium">{{ channel }}</td>
                        <td class="px-3 py-1.5">
                          <div class="relative">
                            <div class="flex h-7 w-full items-center gap-1 rounded border bg-transparent px-1.5 text-[11px]" :class="channelTagInputFocused === channel ? 'border-primary' : ''">
                              <span v-if="getChannelTag(channel) && channelTagInputFocused !== channel" class="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground shrink-0">
                                {{ getChannelTag(channel) }}
                                <button class="hover:text-destructive" @click="removeChannelTag(channel)">
                                  <Icon name="i-lucide-x" class="h-2.5 w-2.5" />
                                </button>
                              </span>
                              <input
                                v-if="!getChannelTag(channel) || channelTagInputFocused === channel"
                                :value="channelTagInputFocused === channel ? channelTagInputValue : ''"
                                class="flex-1 bg-transparent outline-none placeholder:text-muted-foreground min-w-0 text-foreground"
                                placeholder="Add tag…"
                                @focus="channelTagInputFocused = channel; channelTagInputValue = ''"
                                @input="handleChannelTagInput(channel, ($event.target as HTMLInputElement).value)"
                                @keydown.enter="handleChannelTagEnter(channel)"
                                @keydown.escape="channelTagInputFocused = null"
                                @blur="channelTagInputFocused = null"
                              />
                            </div>
                            <div v-if="channelTagInputFocused === channel" class="absolute left-0 top-full z-20 mt-1 w-full rounded-md border bg-popover shadow-md">
                              <div class="p-1 max-h-32 overflow-y-auto">
                                <button v-for="suggestion in channelTagSuggestions" :key="suggestion" class="flex w-full items-center rounded-sm px-2 py-1 text-[11px] transition-colors hover:bg-muted" @mousedown.prevent="handleChannelTagSelect(channel, suggestion)">
                                  {{ suggestion }}
                                </button>
                                <button v-if="channelTagInputValue.trim() && !allUsedChannelTags.includes(channelTagInputValue.trim())" class="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-[11px] text-primary transition-colors hover:bg-muted" @mousedown.prevent="handleChannelTagEnter(channel)">
                                  <Icon name="i-lucide-plus" class="h-3 w-3" />
                                  Create "{{ channelTagInputValue.trim() }}"
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="flex items-center justify-between border-t px-3 py-2">
                  <span class="text-[11px] text-muted-foreground">{{ otaChannels.length }} channels</span>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <!-- Upsell Tags -->
        <div class="mt-4 pt-4 border-t">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div>
                <p class="text-sm font-medium">Upsell Tags</p>
                <p class="text-xs text-muted-foreground">Assign a Jurnal tag per upsell category</p>
              </div>
              <Badge variant="secondary" class="tabular-nums shrink-0">
                {{ jurnalUpsellMappedCount }}/{{ upsellCategories.length }}
              </Badge>
            </div>
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="outline" size="sm" class="h-8 gap-1.5">
                  Assign tags
                  <Icon name="i-lucide-chevron-right" class="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-[400px] p-0" align="end" :side-offset="6">
                <div class="max-h-[320px] overflow-y-auto">
                  <table class="w-full table-fixed text-sm">
                    <thead class="sticky top-0 bg-popover z-10">
                      <tr class="border-b">
                        <th class="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground w-[40%]">Category</th>
                        <th class="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground w-[60%]">Tag</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y">
                      <tr v-for="category in upsellCategories" :key="category">
                        <td class="px-3 py-1.5 text-xs font-medium">{{ category }}</td>
                        <td class="px-3 py-1.5">
                          <div class="relative">
                            <div class="flex h-7 w-full items-center gap-1 rounded border bg-transparent px-1.5 text-[11px]" :class="upsellTagInputFocused === category ? 'border-primary' : ''">
                              <span v-if="getUpsellTag(category) && upsellTagInputFocused !== category" class="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground shrink-0">
                                {{ getUpsellTag(category) }}
                                <button class="hover:text-destructive" @click="removeUpsellTag(category)">
                                  <Icon name="i-lucide-x" class="h-2.5 w-2.5" />
                                </button>
                              </span>
                              <input
                                v-if="!getUpsellTag(category) || upsellTagInputFocused === category"
                                :value="upsellTagInputFocused === category ? upsellTagInputValue : ''"
                                class="flex-1 bg-transparent outline-none placeholder:text-muted-foreground min-w-0 text-foreground"
                                placeholder="Add tag…"
                                @focus="upsellTagInputFocused = category; upsellTagInputValue = ''"
                                @input="handleUpsellTagInput(category, ($event.target as HTMLInputElement).value)"
                                @keydown.enter="handleUpsellTagEnter(category)"
                                @keydown.escape="upsellTagInputFocused = null"
                                @blur="upsellTagInputFocused = null"
                              />
                            </div>
                            <div v-if="upsellTagInputFocused === category" class="absolute left-0 top-full z-20 mt-1 w-full rounded-md border bg-popover shadow-md">
                              <div class="p-1 max-h-32 overflow-y-auto">
                                <button v-for="suggestion in upsellTagSuggestions" :key="suggestion" class="flex w-full items-center rounded-sm px-2 py-1 text-[11px] transition-colors hover:bg-muted" @mousedown.prevent="handleUpsellTagSelect(category, suggestion)">
                                  {{ suggestion }}
                                </button>
                                <button v-if="upsellTagInputValue.trim() && !allUsedUpsellTags.includes(upsellTagInputValue.trim())" class="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-[11px] text-primary transition-colors hover:bg-muted" @mousedown.prevent="handleUpsellTagEnter(category)">
                                  <Icon name="i-lucide-plus" class="h-3 w-3" />
                                  Create "{{ upsellTagInputValue.trim() }}"
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="flex items-center justify-between border-t px-3 py-2">
                  <span class="text-[11px] text-muted-foreground">{{ upsellCategories.length }} categories</span>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <!-- Cost Tags -->
        <div class="mt-4 pt-4 border-t">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div>
                <p class="text-sm font-medium">Cost Tags</p>
                <p class="text-xs text-muted-foreground">Assign a Jurnal tag per cost type</p>
              </div>
              <Badge variant="secondary" class="tabular-nums shrink-0">
                {{ jurnalCostMappedCount }}/{{ costCategories.length }}
              </Badge>
            </div>
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="outline" size="sm" class="h-8 gap-1.5">
                  Assign tags
                  <Icon name="i-lucide-chevron-right" class="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-[400px] p-0" align="end" :side-offset="6">
                <div class="max-h-[240px] overflow-y-auto">
                  <table class="w-full table-fixed text-sm">
                    <thead class="sticky top-0 bg-popover z-10">
                      <tr class="border-b">
                        <th class="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground w-[40%]">Type</th>
                        <th class="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground w-[60%]">Tag</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y">
                      <tr v-for="category in costCategories" :key="category">
                        <td class="px-3 py-1.5 text-xs font-medium">{{ category }}</td>
                        <td class="px-3 py-1.5">
                          <div class="relative">
                            <div class="flex h-7 w-full items-center gap-1 rounded border bg-transparent px-1.5 text-[11px]" :class="costTagInputFocused === category ? 'border-primary' : ''">
                              <span v-if="getCostTag(category) && costTagInputFocused !== category" class="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground shrink-0">
                                {{ getCostTag(category) }}
                                <button class="hover:text-destructive" @click="removeCostTag(category)">
                                  <Icon name="i-lucide-x" class="h-2.5 w-2.5" />
                                </button>
                              </span>
                              <input
                                v-if="!getCostTag(category) || costTagInputFocused === category"
                                :value="costTagInputFocused === category ? costTagInputValue : ''"
                                class="flex-1 bg-transparent outline-none placeholder:text-muted-foreground min-w-0 text-foreground"
                                placeholder="Add tag…"
                                @focus="costTagInputFocused = category; costTagInputValue = ''"
                                @input="handleCostTagInput(category, ($event.target as HTMLInputElement).value)"
                                @keydown.enter="handleCostTagEnter(category)"
                                @keydown.escape="costTagInputFocused = null"
                                @blur="costTagInputFocused = null"
                              />
                            </div>
                            <div v-if="costTagInputFocused === category" class="absolute left-0 top-full z-20 mt-1 w-full rounded-md border bg-popover shadow-md">
                              <div class="p-1 max-h-32 overflow-y-auto">
                                <button v-for="suggestion in costTagSuggestions" :key="suggestion" class="flex w-full items-center rounded-sm px-2 py-1 text-[11px] transition-colors hover:bg-muted" @mousedown.prevent="handleCostTagSelect(category, suggestion)">
                                  {{ suggestion }}
                                </button>
                                <button v-if="costTagInputValue.trim() && !allUsedCostTags.includes(costTagInputValue.trim())" class="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-[11px] text-primary transition-colors hover:bg-muted" @mousedown.prevent="handleCostTagEnter(category)">
                                  <Icon name="i-lucide-plus" class="h-3 w-3" />
                                  Create "{{ costTagInputValue.trim() }}"
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="flex items-center justify-between border-t px-3 py-2">
                  <span class="text-[11px] text-muted-foreground">{{ costCategories.length }} types</span>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter class="mt-4">
          <Button variant="ghost" @click="showConfigDialog = false">Cancel</Button>
          <Button :disabled="hasErrors" @click="handleSave">
            <Icon v-if="hasErrors" name="i-lucide-alert-circle" class="mr-2 h-3.5 w-3.5" />
            Save mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Disconnect dialog -->
    <AlertDialog :open="showDisconnectConfirm" @update:open="showDisconnectConfirm = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect Mekari Jurnal?</AlertDialogTitle>
          <AlertDialogDescription as="div" class="flex flex-col gap-3">
            <p>Your API key will be removed and future entries will no longer be synced automatically.</p>
            <p class="text-xs text-muted-foreground">Entries already pushed to Jurnal will remain there and are not affected.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-destructive-foreground hover:bg-destructive/90" @click="handleDisconnect">Disconnect</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
