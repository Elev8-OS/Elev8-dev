<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { createEmptyPayoutDraft, getListingName, getPayoutProvider, payoutAccounts, payoutProviderLabels, payoutProviders, type PayoutAccount, type PayoutAccountDraft, type PayoutProvider } from './data/payouts'
import DokuLogo from './icons/DokuLogo.vue'
import XenditLogo from './icons/XenditLogo.vue'

const providerDialogOpen = ref(false)
const deleteDialogOpen = ref(false)
const activeTab = ref<'connected' | 'unassigned'>('connected')
const step = ref<1 | 2 | 3>(1)
const mode = ref<'create' | 'edit'>('create')
const selectedProvider = ref<PayoutProvider | null>(null)
const selectedAccountId = ref<string>('')
const selectedListings = ref<string[]>([])
const accountToDelete = ref<PayoutAccount | null>(null)
const unassignedSearch = ref('')
const unassignedTagSearch = ref('')
const selectedUnassignedTags = ref<string[]>([])
const selectedUnassignedListings = ref<string[]>([])
const selectedBulkAccountId = ref('')
const unassignedTagPopoverOpen = ref(false)

const formState = ref<PayoutAccountDraft>(createEmptyPayoutDraft())

const providerConfig = computed(() => selectedProvider.value ? getPayoutProvider(selectedProvider.value) : null)
const providerAccounts = computed(() => selectedProvider.value ? payoutAccounts.value.filter(account => account.provider === selectedProvider.value) : [])
const selectedAccount = computed(() => providerAccounts.value.find(account => account.id === selectedAccountId.value) ?? providerAccounts.value[0] ?? null)
const listingOptions = computed(() => listings.value.map(listing => ({ id: listing.id, name: listing.name, location: listing.location })))
const unassignedListings = computed(() => {
  const query = unassignedSearch.value.trim().toLowerCase()
  const tags = selectedUnassignedTags.value

  return listingOptions.value.filter((listing) => {
    const source = listings.value.find(item => item.id === listing.id)
    const assigned = payoutAccounts.value.some(account => account.listingIds.includes(listing.id))
    if (assigned)
      return false
    if (query && !`${listing.name} ${listing.location} ${(source?.tags ?? []).join(' ')}`.toLowerCase().includes(query))
      return false
    if (tags.length > 0 && !tags.every(tag => source?.tags.includes(tag)))
      return false
    return true
  })
})
const unassignedTags = computed(() => Array.from(new Set(listings.value.filter(listing => !payoutAccounts.value.some(account => account.listingIds.includes(listing.id))).flatMap(listing => listing.tags))).sort())
const selectedBulkAccount = computed(() => payoutAccounts.value.find(account => account.id === selectedBulkAccountId.value) ?? null)
const selectedUnassignedCount = computed(() => selectedUnassignedListings.value.length)
const assignSearch = ref('')
const assignTagSearch = ref('')
const assignTagPopoverOpen = ref(false)
const assignableListings = computed(() => {
  const query = assignSearch.value.trim().toLowerCase()
  const tags = assignTagSearch.value.trim().toLowerCase()
  return listingOptions.value.filter((listing) => {
    const source = listings.value.find(item => item.id === listing.id)
    const haystack = `${listing.name} ${listing.location} ${(source?.tags ?? []).join(' ')}`.toLowerCase()
    if (query && !haystack.includes(query))
      return false
    if (tags && !(source?.tags ?? []).some(tag => tag.toLowerCase().includes(tags)))
      return false
    return true
  })
})
const assignTags = computed(() => Array.from(new Set(listings.value.flatMap(listing => listing.tags))).sort())
const hasAccounts = computed(() => payoutAccounts.value.length > 0)
const providerFields = computed(() => providerConfig.value?.fields ?? [])

function resetWizard() {
  step.value = 1
  mode.value = 'create'
  selectedProvider.value = null
  selectedAccountId.value = ''
  selectedListings.value = []
  formState.value = createEmptyPayoutDraft()
}

function openCreateWizard() {
  resetWizard()
  providerDialogOpen.value = true
}

function openEditWizard(account: PayoutAccount) {
  resetWizard()
  mode.value = 'edit'
  selectedProvider.value = account.provider
  selectedAccountId.value = account.id
  selectedListings.value = [...account.listingIds]
  formState.value = {
    accountName: account.accountName,
    publishableKey: account.provider === 'stripe' ? (account.publicKey ?? '') : '',
    secretKey: account.provider === 'stripe' ? (account.secretKey ?? '') : '',
    clientId: account.provider === 'doku' ? (account.publicKey ?? '') : '',
    activeSecretKey: account.provider === 'doku' ? (account.secretKey ?? '') : '',
    publicKey: account.provider === 'xendit' ? (account.publicKey ?? '') : '',
    webhookSecret: account.webhookSecret ?? '',
  }
  step.value = 2
  providerDialogOpen.value = true
}

function chooseProvider(provider: PayoutProvider) {
  selectedProvider.value = provider
  step.value = 2
}

function updateField(key: keyof PayoutAccountDraft, value: string | number) {
  formState.value = {
    ...formState.value,
    [key]: String(value),
  }
}

function nextFromCredentials() {
  if (!selectedProvider.value)
    return
  step.value = 3
}

function toggleListing(listingId: string) {
  selectedListings.value = selectedListings.value.includes(listingId)
    ? selectedListings.value.filter(id => id !== listingId)
    : [...selectedListings.value, listingId]
}

const allVisibleSelected = computed(() => {
  if (!assignableListings.value.length)
    return false
  return assignableListings.value.every(listing => selectedListings.value.includes(listing.id))
})

function toggleSelectAllVisible() {
  if (allVisibleSelected.value) {
    const visibleIds = new Set(assignableListings.value.map(l => l.id))
    selectedListings.value = selectedListings.value.filter(id => !visibleIds.has(id))
  }
  else {
    const merged = new Set(selectedListings.value)
    for (const listing of assignableListings.value)
      merged.add(listing.id)
    selectedListings.value = Array.from(merged)
  }
}

function buildAccountPayload(id: string): PayoutAccount {
  const provider = selectedProvider.value as PayoutProvider
  return {
    id,
    provider,
    accountName: formState.value.accountName || `${payoutProviderLabels[provider]} account`,
    status: provider === 'xendit' && !formState.value.webhookSecret ? 'needs_webhook' : 'connected',
    liveMode: true,
    connectedAt: selectedAccount.value?.connectedAt ?? new Date().toISOString().slice(0, 10),
    currency: provider === 'stripe' ? 'USD' : 'IDR',
    listingIds: [...selectedListings.value],
    publicKey: provider === 'stripe'
      ? formState.value.publishableKey
      : provider === 'doku'
        ? formState.value.clientId
        : formState.value.publicKey,
    secretKey: provider === 'stripe'
      ? formState.value.secretKey
      : provider === 'doku'
        ? formState.value.activeSecretKey
        : formState.value.secretKey,
    webhookSecret: formState.value.webhookSecret || undefined,
    notes: providerConfig.value?.connectCopy,
  }
}

function saveAccount() {
  if (!selectedProvider.value)
    return

  const currentId = selectedAccount.value?.id ?? `pay-${Date.now()}`
  const nextAccount = buildAccountPayload(currentId)
  const existingIndex = payoutAccounts.value.findIndex(account => account.id === currentId)
  if (existingIndex >= 0)
    payoutAccounts.value[existingIndex] = nextAccount
  else
    payoutAccounts.value = [nextAccount, ...payoutAccounts.value]

  selectedAccountId.value = nextAccount.id
  providerDialogOpen.value = false
  toast.success(mode.value === 'edit' ? 'Account updated.' : `${nextAccount.accountName} saved.`)
}

function statusTone(status: PayoutAccount['status']) {
  if (status === 'connected') return 'default'
  if (status === 'needs_webhook') return 'secondary'
  return 'outline'
}

function openDetails(account: PayoutAccount) {
  selectedProvider.value = account.provider
  selectedAccountId.value = account.id
  selectedListings.value = [...account.listingIds]
}

function askDelete(account: PayoutAccount) {
  accountToDelete.value = account
  deleteDialogOpen.value = true
}

function confirmDelete() {
  if (!accountToDelete.value)
    return
  payoutAccounts.value = payoutAccounts.value.filter(account => account.id !== accountToDelete.value?.id)
  if (selectedAccountId.value === accountToDelete.value.id)
    selectedAccountId.value = ''
  toast.success('Account deleted.')
  deleteDialogOpen.value = false
  accountToDelete.value = null
}

function backFromCredentials() {
  if (mode.value === 'edit') {
    providerDialogOpen.value = false
    return
  }
  step.value = 1
}

function toggleAssignTag(tag: string) {
  assignTagSearch.value = assignTagSearch.value === tag ? '' : tag
}


function toggleUnassignedListing(listingId: string) {
  selectedUnassignedListings.value = selectedUnassignedListings.value.includes(listingId)
    ? selectedUnassignedListings.value.filter(id => id !== listingId)
    : [...selectedUnassignedListings.value, listingId]
}

const allUnassignedVisibleSelected = computed(() => {
  if (!unassignedListings.value.length)
    return false
  return unassignedListings.value.every(listing => selectedUnassignedListings.value.includes(listing.id))
})

function toggleSelectAllUnassigned() {
  if (allUnassignedVisibleSelected.value) {
    const visibleIds = new Set(unassignedListings.value.map(l => l.id))
    selectedUnassignedListings.value = selectedUnassignedListings.value.filter(id => !visibleIds.has(id))
  }
  else {
    const merged = new Set(selectedUnassignedListings.value)
    for (const listing of unassignedListings.value)
      merged.add(listing.id)
    selectedUnassignedListings.value = Array.from(merged)
  }
}

function toggleUnassignedTag(tag: string) {
  selectedUnassignedTags.value = selectedUnassignedTags.value.includes(tag)
    ? selectedUnassignedTags.value.filter(item => item !== tag)
    : [...selectedUnassignedTags.value, tag]
}

function clearUnassignedFilters() {
  unassignedSearch.value = ''
  unassignedTagSearch.value = ''
  selectedUnassignedTags.value = []
}

function setBulkAccountId(value: string | number | null | undefined) {
  selectedBulkAccountId.value = value ? String(value) : ''
}

function bulkAssignSelected() {
  if (!selectedBulkAccount.value || !selectedUnassignedListings.value.length)
    return

  const accountId = selectedBulkAccount.value.id
  payoutAccounts.value = payoutAccounts.value.map((account) => {
    if (account.id === accountId) {
      const merged = Array.from(new Set([...account.listingIds, ...selectedUnassignedListings.value]))
      return { ...account, listingIds: merged }
    }
    return {
      ...account,
      listingIds: account.listingIds.filter(id => !selectedUnassignedListings.value.includes(id)),
    }
  })

  toast.success(`${selectedUnassignedListings.value.length} listing${selectedUnassignedListings.value.length > 1 ? 's' : ''} assigned.`)
  selectedUnassignedListings.value = []
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-end justify-between gap-4">
      <div class="space-y-1">
        <h3 class="text-lg font-medium">Payment Gateways</h3>
        <p class="text-sm text-muted-foreground">Connect your payment gateway to send and receive payments securely on Elev8.</p>
      </div>
      <Button class="gap-2" @click="openCreateWizard">
        <Icon name="lucide:plus" class="size-4" />
        Add account
      </Button>
    </div>

    <div v-if="!hasAccounts" class="border border-dashed bg-card/40 p-10 text-center">
      <div class="mx-auto flex max-w-md flex-col items-center gap-4">
        <div class="flex size-12 items-center justify-center rounded-full border bg-background">
          <Icon name="lucide:credit-card" class="size-5 text-muted-foreground" />
        </div>
        <div class="space-y-2">
          <p class="text-base font-medium">No payout account yet</p>
          <p class="text-sm text-muted-foreground">Add a Stripe, Doku, or Xendit account to start assigning listings.</p>
        </div>
        <Button class="gap-2" @click="openCreateWizard">
          <Icon name="lucide:plus" class="size-4" />
          Add account
        </Button>
      </div>
    </div>

    <Tabs v-model="activeTab" class="space-y-4">
      <TabsList>
        <TabsTrigger value="connected">Connected</TabsTrigger>
        <TabsTrigger value="unassigned" class="gap-2">
          Listing Unassigned
          <Badge variant="secondary" class="rounded-full px-2 py-0 text-[10px]">{{ unassignedListings.length }}</Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="connected" class="space-y-4">
        <div class="space-y-3">
          <div
            v-for="account in payoutAccounts"
            :key="account.id"
            class="rounded-lg border bg-card p-4"
          >
            <div class="flex items-start gap-3">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/30">
                <DokuLogo v-if="account.provider === 'doku'" class="size-8" />
                <XenditLogo v-else-if="account.provider === 'xendit'" class="size-8" />
                <Icon v-else :name="getPayoutProvider(account.provider).icon" class="size-5" />
              </div>
              <div class="min-w-0 flex-1">
                <button type="button" class="block w-full text-left" @click="openDetails(account)">
                  <p class="truncate text-sm font-medium">{{ account.accountName }}</p>
                  <p class="mt-1 text-xs text-muted-foreground">{{ account.currency }} · {{ account.listingIds.length }} listings</p>
                </button>
                <div class="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" class="h-8 gap-1.5" @click="openEditWizard(account)">
                    <Icon name="lucide:pencil" class="size-3.5" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" class="h-8 gap-1.5 text-destructive hover:text-destructive" @click="askDelete(account)">
                    <Icon name="lucide:trash-2" class="size-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="unassigned" class="space-y-4">
        <div class="rounded-lg border bg-card p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-medium">Listing Unassigned</p>
              <p class="text-sm text-muted-foreground">Listings that are not connected to any payout account.</p>
            </div>
            <Badge variant="outline">{{ unassignedListings.length }}</Badge>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div class="relative min-w-[260px] flex-1">
            <Icon name="lucide:search" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="unassignedSearch" placeholder="Search listing or location" class="h-10 pl-9" />
          </div>
          <Popover v-model:open="unassignedTagPopoverOpen">
            <PopoverTrigger as-child>
              <Button variant="outline" class="gap-2">
                <Icon name="lucide:tags" class="size-4" />
                Tags
                <Badge variant="secondary" class="ml-1">{{ selectedUnassignedTags.length }}</Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-72 p-0" align="start" :side-offset="4">
              <div class="space-y-2 p-2">
                <Input v-model="unassignedTagSearch" placeholder="Search tags..." class="h-8 text-xs" />
                <div class="max-h-56 space-y-1 overflow-auto">
                  <button
                    v-for="tag in unassignedTags.filter(t => t.toLowerCase().includes(unassignedTagSearch.trim().toLowerCase()))"
                    :key="tag"
                    type="button"
                    class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    @click="toggleUnassignedTag(tag)"
                  >
                    <Checkbox :model-value="selectedUnassignedTags.includes(tag)" class="size-3.5" @update:model-value="() => toggleUnassignedTag(tag)" />
                    <span>{{ tag }}</span>
                  </button>
                  <p v-if="!unassignedTags.filter(t => t.toLowerCase().includes(unassignedTagSearch.trim().toLowerCase())).length" class="px-2 py-3 text-sm text-muted-foreground">
                    No tags found.
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" class="h-10" @click="clearUnassignedFilters">
            Clear filters
          </Button>
        </div>

        <div class="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
          <div class="flex items-center gap-3">
            <p class="text-sm text-muted-foreground">
              {{ selectedUnassignedCount }} selected · {{ unassignedListings.length }} shown
            </p>
            <Button
              v-if="unassignedListings.length"
              variant="outline"
              size="sm"
              class="h-7 text-xs"
              @click="toggleSelectAllUnassigned"
            >
              {{ allUnassignedVisibleSelected ? 'Deselect all' : 'Select all' }}
              <span v-if="!allUnassignedVisibleSelected" class="ml-1 text-muted-foreground">({{ unassignedListings.length }})</span>
            </Button>
          </div>
          <div class="flex items-center gap-2">
            <Select :model-value="selectedBulkAccountId" @update:model-value="setBulkAccountId">
              <SelectTrigger class="h-9 w-[220px]">
                <SelectValue placeholder="Bulk assign to account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="account in payoutAccounts" :key="account.id" :value="account.id">
                  {{ account.accountName }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button :disabled="!selectedBulkAccount || selectedUnassignedCount === 0" @click="bulkAssignSelected">
              Assign selected
            </Button>
          </div>
        </div>

        <div v-if="unassignedListings.length" class="space-y-3">
          <div v-for="listing in unassignedListings" :key="listing.id" class="rounded-lg border bg-card p-4">
            <label class="flex items-start gap-3">
              <Checkbox :model-value="selectedUnassignedListings.includes(listing.id)" @update:model-value="() => toggleUnassignedListing(listing.id)" />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium">{{ listing.name }}</p>
                <p class="mt-1 text-xs text-muted-foreground">{{ listing.location }}</p>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <Badge v-for="tag in listings.find(item => item.id === listing.id)?.tags ?? []" :key="tag" variant="outline" class="text-[10px]">
                    {{ tag }}
                  </Badge>
                </div>
              </div>
            </label>
          </div>
        </div>
        <Empty v-else class="border bg-card/40 py-10">
          <Icon name="lucide:check-circle-2" class="size-8 text-muted-foreground" />
          <div class="space-y-1">
            <p class="font-medium">All listings are assigned</p>
            <p class="text-sm text-muted-foreground">Every listing already has a payout account.</p>
          </div>
        </Empty>
      </TabsContent>
    </Tabs>

    <Dialog v-model:open="providerDialogOpen">
      <DialogContent class="max-w-5xl w-[min(96vw,64rem)]">
        <DialogHeader>
          <DialogTitle>
            <template v-if="mode === 'edit'">Edit payout account</template>
            <template v-else>
              <template v-if="step === 1">Add payout account</template>
              <template v-else-if="step === 2">{{ providerConfig?.name }} credentials</template>
              <template v-else>Assign listings</template>
            </template>
          </DialogTitle>
          <DialogDescription>
            <template v-if="mode === 'edit'">Update the credential values or listing assignment for this account.</template>
            <template v-else>
              <template v-if="step === 1">Choose a provider to connect.</template>
              <template v-else-if="step === 2">Enter the provider keys required by Elev8.</template>
              <template v-else>Select the listings that should use this payout account.</template>
            </template>
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-6">
          <div v-if="mode === 'create' && step === 1" class="space-y-3">
            <button
              v-for="provider in payoutProviders"
              :key="provider.id"
              type="button"
              class="flex w-full items-start justify-between gap-4 rounded-lg border bg-background p-4 text-left transition-colors hover:bg-muted/40"
              @click="chooseProvider(provider.id)"
            >
              <div class="min-w-0 space-y-1">
                <p class="text-sm font-medium">{{ provider.name }}</p>
                <p class="text-xs text-muted-foreground">{{ provider.description }}</p>
              </div>
              <div class="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/30">
                <DokuLogo v-if="provider.id === 'doku'" class="size-8" />
                <XenditLogo v-else-if="provider.id === 'xendit'" class="size-8" />
                <Icon v-else :name="provider.icon" class="size-5" />
              </div>
            </button>
          </div>

          <div v-else-if="step === 2 && providerConfig" class="space-y-5">
            <div class="space-y-5">
              <div v-if="mode === 'create'">
                <Label for="account-name">Account Label</Label>
                <Input id="account-name" v-model="formState.accountName" class="mt-2 h-11" placeholder="Main payout account" />
              </div>

              <div v-for="field in providerFields" :key="field.key" class="space-y-2.5">
                <Label :for="field.key">{{ field.label }}</Label>
                <Input
                  :id="field.key"
                  :model-value="formState[field.key as keyof PayoutAccountDraft]"
                  :type="field.secret ? 'password' : 'text'"
                  :placeholder="field.placeholder"
                  class="h-11"
                  @update:model-value="updateField(field.key as keyof PayoutAccountDraft, $event)"
                />
                <p class="text-xs text-muted-foreground">{{ field.helper }}</p>
              </div>
            </div>

            <div class="rounded-lg border bg-muted/20 p-5 text-sm text-muted-foreground">
              <p class="font-medium text-foreground">How to connect</p>
              <div class="mt-3 space-y-2">
                <p v-for="stepItem in providerConfig.steps" :key="stepItem" class="flex gap-2"><span>•</span><span>{{ stepItem }}</span></p>
              </div>

            </div>
          </div>

          <div v-else-if="step === 3" class="space-y-4">
            <div class="flex flex-wrap items-center gap-2">
              <div class="relative min-w-[260px] flex-1">
                <Icon name="lucide:search" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input v-model="assignSearch" placeholder="Search listing or location" class="h-10 pl-9" />
              </div>
              <Popover v-model:open="assignTagPopoverOpen">
                <PopoverTrigger as-child>
                  <Button variant="outline" class="gap-2">
                    <Icon name="lucide:tags" class="size-4" />
                    Tags
                    <Badge variant="secondary" class="ml-1">{{ assignTagSearch ? 1 : 0 }}</Badge>
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-72 p-0" align="start" :side-offset="4">
                  <div class="space-y-2 p-2">
                    <Input v-model="assignTagSearch" placeholder="Search tags..." class="h-8 text-xs" />
                    <div class="max-h-56 space-y-1 overflow-auto">
                      <button
                        v-for="tag in assignTags.filter(t => t.toLowerCase().includes(assignTagSearch.trim().toLowerCase()))"
                        :key="tag"
                        type="button"
                        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        @click="toggleAssignTag(tag)"
                      >
                        <Checkbox :model-value="assignTagSearch === tag" class="size-3.5" @update:model-value="() => toggleAssignTag(tag)" />
                        <span>{{ tag }}</span>
                      </button>
                      <p v-if="!assignTags.filter(t => t.toLowerCase().includes(assignTagSearch.trim().toLowerCase())).length" class="px-2 py-3 text-sm text-muted-foreground">
                        No tags found.
                      </p>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button v-if="assignSearch || assignTagSearch" variant="ghost" class="h-10 w-10 p-0" @click="assignSearch = ''; assignTagSearch = ''">
                <Icon name="lucide:x" class="size-4" />
              </Button>
            </div>

            <div class="max-h-[360px] space-y-2 overflow-auto pr-1">
              <label v-for="listing in assignableListings" :key="listing.id" class="flex items-start gap-3 rounded-lg border bg-background p-3 text-sm">
                <Checkbox :model-value="selectedListings.includes(listing.id)" @update:model-value="() => toggleListing(listing.id)" />
                <div class="min-w-0 flex-1">
                  <p class="truncate font-medium">{{ listing.name }}</p>
                  <p class="text-xs text-muted-foreground">{{ listing.location }}</p>
                  <div class="mt-2 flex flex-wrap gap-1.5">
                    <Badge v-for="tag in listings.find(item => item.id === listing.id)?.tags ?? []" :key="tag" variant="outline" class="text-[10px]">
                      {{ tag }}
                    </Badge>
                  </div>
                </div>
              </label>
            </div>

            <div class="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3 text-sm">
              <p class="text-muted-foreground">{{ selectedListings.length }} listing{{ selectedListings.length !== 1 ? 's' : '' }} selected</p>
              <Button
                v-if="assignableListings.length"
                variant="outline"
                size="sm"
                class="h-7 text-xs"
                @click="toggleSelectAllVisible"
              >
                {{ allVisibleSelected ? 'Deselect all' : 'Select all' }}
                <span v-if="!allVisibleSelected" class="ml-1 text-muted-foreground">({{ assignableListings.length }})</span>
              </Button>
            </div>
          </div>
        </div>

        <div v-if="step === 2 || step === 3" class="flex items-center justify-between gap-3 border-t pt-4">
          <Button v-if="step === 2" variant="outline" @click="backFromCredentials">Back</Button>
          <Button v-else variant="outline" @click="step = 2">Back</Button>

          <Button
            v-if="step === 2"
            @click="nextFromCredentials"
          >
            Continue
          </Button>
          <Button
            v-else
            @click="saveAccount"
          >
            Save account
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="deleteDialogOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete payout account?</DialogTitle>
          <DialogDescription>This will remove the payout account and its listing assignment.</DialogDescription>
        </DialogHeader>
        <div class="rounded-lg border bg-muted/20 p-4 text-sm">
          <p class="font-medium">{{ accountToDelete?.accountName }}</p>
          <p class="mt-1 text-muted-foreground">{{ accountToDelete ? payoutProviderLabels[accountToDelete.provider] : '' }}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="deleteDialogOpen = false">Cancel</Button>
          <Button variant="destructive" @click="confirmDelete">Delete account</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
