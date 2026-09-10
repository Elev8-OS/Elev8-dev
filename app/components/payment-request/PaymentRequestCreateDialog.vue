<script setup lang="ts">
import type { FeeMode, GuestOption } from './data/payment-requests'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { payoutAccounts } from '~/components/settings/data/payouts'
import { useInbox } from '~/composables/useInbox'
import { usePaymentRequests } from '~/composables/usePaymentRequests'
import FeeCalculator from './FeeCalculator.vue'

const props = defineProps<{
  /**
   * Prefills the guest when the caller already knows who is being billed, as
   * the guest detail page does. Omit it and the dialog opens on its own guest
   * search exactly as before.
   */
  initialGuest?: Pick<GuestOption, 'name' | 'email' | 'phone'>
}>()

const emit = defineEmits<{
  created: [request: PaymentRequest]
}>()

const open = defineModel<boolean>('open', { default: false })

const { createRequest, isListingAssigned } = usePaymentRequests()
const { conversations } = useInbox()
const paymentRequestStore = usePaymentRequests()

const guestName = ref('')
const guestEmail = ref('')
const guestPhone = ref('')
const selectedGuest = ref<GuestOption | null>(null)
const selectedListingId = ref('')
const title = ref('')
const description = ref('')
const amount = ref<number | null>(null)
const feeMode = ref<FeeMode>('card')
const customFeePercentage = ref<number>(0)
const expiresInHours = ref(24)

// Guest search state
const guestPopoverOpen = ref(false)
const guestSearch = ref('')

// Listing search state
const listingPopoverOpen = ref(false)
const listingSearch = ref('')
const listingTagPopoverOpen = ref(false)
const listingTagSearch = ref('')
const selectedListingTags = ref<string[]>([])

const filteredListings = computed(() => {
  const query = listingSearch.value.trim().toLowerCase()
  return listings.value.filter((l) => {
    const haystack = `${l.name} ${l.location} ${l.tags.join(' ')}`.toLowerCase()
    if (query && !haystack.includes(query))
      return false
    if (selectedListingTags.value.length > 0 && !selectedListingTags.value.every(tag => l.tags.includes(tag)))
      return false
    return true
  })
})

const allListingTags = computed(() => {
  const tags = new Set<string>()
  for (const l of listings.value)
    l.tags.forEach(t => tags.add(t))
  return Array.from(tags).sort()
})

function toggleListingTag(tag: string) {
  if (selectedListingTags.value.includes(tag))
    selectedListingTags.value = selectedListingTags.value.filter(t => t !== tag)
  else
    selectedListingTags.value = [...selectedListingTags.value, tag]
}

function selectListing(listingId: string) {
  selectedListingId.value = listingId
  listingPopoverOpen.value = false
  listingSearch.value = ''
}

const guestOptions = computed<GuestOption[]>(() => {
  const options: GuestOption[] = []
  const seen = new Set<string>()

  for (const conv of conversations.value) {
    const key = conv.guestName.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      options.push({
        id: `inbox-${conv.id}`,
        name: conv.guestName,
        email: conv.guestEmail ?? '',
        avatar: conv.guestAvatar,
        source: 'inbox',
        lastStay: conv.reservation ? new Date(conv.reservation.checkIn).toLocaleDateString() : undefined,
        listingName: conv.listingName,
      })
    }
  }

  for (const req of paymentRequestStore.requests.value) {
    const key = req.guestName.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      options.push({
        id: `pr-${req.id}`,
        name: req.guestName,
        email: req.guestEmail,
        phone: req.guestPhone,
        source: 'payment_request',
      })
    }
  }

  return options
})

const filteredGuests = computed(() => {
  const query = guestSearch.value.trim().toLowerCase()
  if (!query)
    return guestOptions.value
  return guestOptions.value.filter(g =>
    g.name.toLowerCase().includes(query)
    || g.email.toLowerCase().includes(query)
    || (g.phone?.toLowerCase().includes(query) ?? false),
  )
})

const inboxGuests = computed(() => filteredGuests.value.filter(g => g.source === 'inbox'))
const previousGuests = computed(() => filteredGuests.value.filter(g => g.source === 'payment_request'))

function selectGuest(guest: GuestOption) {
  guestName.value = guest.name
  guestEmail.value = guest.email
  guestPhone.value = guest.phone ?? ''
  selectedGuest.value = guest
  guestSearch.value = ''
  guestPopoverOpen.value = false
  if (guest.listingName) {
    const listing = listings.value.find(l => l.name === guest.listingName)
    if (listing)
      selectedListingId.value = listing.id
  }
}

function addNewGuest() {
  const name = guestSearch.value.trim()
  if (!name)
    return
  guestName.value = name
  guestEmail.value = ''
  guestPhone.value = ''
  selectedGuest.value = { id: `manual-${Date.now()}`, name, email: '', source: 'manual' }
  guestSearch.value = ''
  guestPopoverOpen.value = false
}

const assigned = computed(() => selectedListingId.value ? isListingAssigned(selectedListingId.value) : true)
const account = computed(() => payoutAccounts.value.find(a => a.listingIds.includes(selectedListingId.value)))
const currency = computed(() => account.value?.currency ?? 'USD')

const minAmount = computed(() => {
  if (account.value?.provider === 'stripe')
    return 0.5
  if (account.value?.provider === 'doku')
    return 10000
  return 0.01
})

const amountError = computed(() => {
  if (!amount.value || amount.value <= 0)
    return 'Amount must be greater than 0'
  if (amount.value < minAmount.value) {
    const symbol = currency.value === 'IDR' ? 'Rp' : '$'
    return `Minimum amount is ${symbol}${minAmount.value}`
  }
  return ''
})

const canContinue = computed(() => {
  return guestName.value.trim().length >= 2
    && guestEmail.value.includes('@')
    && selectedListingId.value
    && title.value.trim().length >= 3
    && amount.value && amount.value > 0
    && amount.value >= minAmount.value
    && assigned.value
})

function reset() {
  guestName.value = ''
  guestEmail.value = ''
  guestPhone.value = ''
  selectedGuest.value = null
  selectedListingId.value = ''
  title.value = ''
  description.value = ''
  amount.value = null
  feeMode.value = 'card'
  customFeePercentage.value = 0
  expiresInHours.value = 24
  guestSearch.value = ''
  listingSearch.value = ''
  listingTagSearch.value = ''
  selectedListingTags.value = []
}

function handleCreate() {
  if (!amount.value)
    return

  const request = createRequest({
    guestName: guestName.value,
    guestEmail: guestEmail.value,
    guestPhone: guestPhone.value || undefined,
    listingId: selectedListingId.value,
    title: title.value,
    description: description.value || undefined,
    amount: amount.value,
    currency: currency.value,
    feeMode: feeMode.value,
    customFeePercentage: feeMode.value === 'manual' ? customFeePercentage.value : undefined,
    expiresInHours: expiresInHours.value,
  })

  emit('created', request)
  toast.success('Payment request created')
  open.value = false
  reset()
}

function applyGuestPrefill() {
  const g = props.initialGuest
  if (!g?.name)
    return
  guestName.value = g.name
  guestEmail.value = g.email ?? ''
  guestPhone.value = g.phone ?? ''
  selectedGuest.value = {
    id: `guest-prefill-${g.name}`,
    name: g.name,
    email: g.email ?? '',
    phone: g.phone,
    source: 'manual',
  }
}

watch(open, (val) => {
  if (val) {
    // Reopening must not inherit the last attempt's fields, so reset first and
    // then re-apply the prefill.
    reset()
    applyGuestPrefill()
    return
  }
  reset()
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>Create Payment Request</DialogTitle>
        <DialogDescription>
          Enter payment details for the guest.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label>Guest name *</Label>
          <Popover v-model:open="guestPopoverOpen">
            <PopoverTrigger as-child>
              <Button variant="outline" class="w-full justify-between">
                {{ guestName || 'Search guest...' }}
                <Icon name="lucide:chevrons-up-down" class="size-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-[380px] p-0" align="start">
              <Command>
                <CommandInput v-model="guestSearch" placeholder="Search guest by name or email..." />
                <CommandList>
                  <CommandEmpty v-if="!guestSearch.trim()">
                    Type to search guests...
                  </CommandEmpty>
                  <CommandEmpty v-else-if="!filteredGuests.length">
                    <button
                      type="button"
                      class="flex w-full items-center gap-2 py-2 text-sm hover:text-primary"
                      @click="addNewGuest"
                    >
                      <Icon name="lucide:plus" class="size-4" />
                      Add new guest "{{ guestSearch.trim() }}"
                    </button>
                  </CommandEmpty>
                  <CommandGroup v-if="inboxGuests.length" heading="Recent Guests">
                    <CommandItem
                      v-for="guest in inboxGuests"
                      :key="guest.id"
                      :value="guest.name"
                      class="cursor-pointer"
                      @select="selectGuest(guest)"
                    >
                      <div class="flex items-center gap-2">
                        <Avatar v-if="guest.avatar" class="size-6">
                          <AvatarImage :src="guest.avatar" />
                        </Avatar>
                        <div v-else class="flex size-6 items-center justify-center rounded-full bg-muted text-[10px]">
                          {{ guest.name.charAt(0) }}
                        </div>
                        <div class="min-w-0">
                          <p class="text-sm font-medium">
                            {{ guest.name }}
                          </p>
                          <p class="text-xs text-muted-foreground">
                            {{ guest.email }}
                          </p>
                        </div>
                      </div>
                    </CommandItem>
                  </CommandGroup>
                  <CommandGroup v-if="previousGuests.length" heading="Previous Requests">
                    <CommandItem
                      v-for="guest in previousGuests"
                      :key="guest.id"
                      :value="guest.name"
                      class="cursor-pointer"
                      @select="selectGuest(guest)"
                    >
                      <div class="flex items-center gap-2">
                        <div class="flex size-6 items-center justify-center rounded-full bg-muted text-[10px]">
                          {{ guest.name.charAt(0) }}
                        </div>
                        <div class="min-w-0">
                          <p class="text-sm font-medium">
                            {{ guest.name }}
                          </p>
                          <p class="text-xs text-muted-foreground">
                            {{ guest.email }}
                          </p>
                        </div>
                      </div>
                    </CommandItem>
                  </CommandGroup>
                  <CommandGroup v-if="guestSearch.trim() && filteredGuests.length > 0">
                    <CommandItem
                      :value="`__add_new__${guestSearch.trim()}`"
                      class="cursor-pointer"
                      @select="addNewGuest"
                    >
                      <div class="flex items-center gap-2">
                        <Icon name="lucide:plus" class="size-4" />
                        <span>Add new guest "{{ guestSearch.trim() }}"</span>
                      </div>
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div class="space-y-2">
          <Label>Select Listing *</Label>
          <Popover v-model:open="listingPopoverOpen">
            <PopoverTrigger as-child>
              <Button variant="outline" class="w-full justify-between">
                {{ listings.find(l => l.id === selectedListingId)?.name || 'Choose a property' }}
                <Icon name="lucide:chevrons-up-down" class="size-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-[380px] p-0" align="start">
              <Command>
                <div class="flex w-full items-center">
                  <div class="flex-1 min-w-0">
                    <CommandInput v-model="listingSearch" placeholder="Search listing or location..." class="border-0 focus:ring-0" />
                  </div>
                  <div class="pr-2">
                    <Popover v-model:open="listingTagPopoverOpen">
                      <PopoverTrigger as-child>
                        <Button
                          variant="ghost"
                          size="sm"
                          class="h-7 gap-1 px-2 text-xs"
                          :class="selectedListingTags.length ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground'"
                        >
                          <Icon name="lucide:tags" class="size-3.5" />
                          Tags
                          <Badge v-if="selectedListingTags.length" variant="default" class="ml-0.5 h-4 px-1 text-[10px]">
                            {{ selectedListingTags.length }}
                          </Badge>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent class="w-56 p-0" align="end">
                        <div class="space-y-2 p-2">
                          <Input v-model="listingTagSearch" placeholder="Search tags..." class="h-8 text-xs" />
                          <div class="max-h-40 space-y-1 overflow-auto">
                            <button
                              v-for="tag in allListingTags.filter(t => t.toLowerCase().includes(listingTagSearch.trim().toLowerCase()))"
                              :key="tag"
                              type="button"
                              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                              @click="toggleListingTag(tag)"
                            >
                              <Checkbox :model-value="selectedListingTags.includes(tag)" class="size-3.5" />
                              <span>{{ tag }}</span>
                            </button>
                            <p v-if="!allListingTags.filter(t => t.toLowerCase().includes(listingTagSearch.trim().toLowerCase())).length" class="px-2 py-3 text-sm text-muted-foreground">
                              No tags found.
                            </p>
                          </div>
                          <Button v-if="selectedListingTags.length" variant="ghost" size="sm" class="h-7 w-full text-xs text-muted-foreground" @click="selectedListingTags = []">
                            Clear all
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <CommandList>
                  <CommandEmpty>
                    <div v-if="listingSearch.trim() || selectedListingTags.length" class="py-3 text-center">
                      <p class="text-sm text-muted-foreground">
                        No listing found.
                      </p>
                    </div>
                    <div v-else class="py-3 text-center text-sm text-muted-foreground">
                      Type to search...
                    </div>
                  </CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      v-for="listing in filteredListings"
                      :key="listing.id"
                      :value="listing.name"
                      class="cursor-pointer"
                      @select="selectListing(listing.id)"
                    >
                      <div class="flex items-start gap-2 w-full">
                        <div class="min-w-0 flex-1">
                          <p class="text-sm font-medium">
                            {{ listing.name }}
                          </p>
                          <p class="text-xs text-muted-foreground">
                            {{ listing.location }}
                          </p>
                          <div class="mt-1 flex flex-wrap gap-1">
                            <Badge v-for="tag in listing.tags" :key="tag" variant="outline" class="text-[10px]">
                              {{ tag }}
                            </Badge>
                          </div>
                        </div>
                        <Icon v-if="selectedListingId === listing.id" name="lucide:check" class="size-4 text-primary mt-1" />
                      </div>
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Alert v-if="selectedListingId && !assigned" variant="destructive" class="text-xs">
            <Icon name="lucide:alert-circle" class="size-4" />
            <AlertTitle>Not assigned</AlertTitle>
            <AlertDescription>
              This listing has no payout account.
              <NuxtLink to="/settings/payouts" class="underline">
                Assign now
              </NuxtLink>
            </AlertDescription>
          </Alert>
          <p v-else-if="account" class="text-xs text-muted-foreground">
            Connected to: {{ account.accountName }} ({{ currency }})
          </p>
        </div>

        <div class="space-y-2">
          <Label>Payment title *</Label>
          <Input v-model="title" placeholder="e.g. Downpayment Villa Sunset" />
        </div>

        <div class="space-y-2">
          <Label>Description</Label>
          <Textarea v-model="description" placeholder="Internal notes..." />
        </div>

        <div class="space-y-2">
          <Label>Email for invoice *</Label>
          <Input v-model="guestEmail" type="email" placeholder="guest@example.com" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label>Amount *</Label>
            <Input v-model.number="amount" type="number" :min="minAmount" step="0.01" />
            <p v-if="amountError" class="text-xs text-destructive">
              {{ amountError }}
            </p>
          </div>
          <div class="space-y-2">
            <Label>Currency</Label>
            <Input :model-value="currency" disabled />
          </div>
        </div>

        <div class="space-y-2">
          <Label>Fee mode</Label>
          <RadioGroup v-model="feeMode" class="flex gap-4">
            <div class="flex items-center space-x-2">
              <RadioGroupItem id="card" value="card" />
              <Label for="card" class="text-sm font-normal">Card (+3%)</Label>
            </div>
            <div class="flex items-center space-x-2">
              <RadioGroupItem id="manual" value="manual" />
              <Label for="manual" class="text-sm font-normal">Manual</Label>
            </div>
            <div class="flex items-center space-x-2">
              <RadioGroupItem id="no_fee" value="no_fee" />
              <Label for="no_fee" class="text-sm font-normal">No fee</Label>
            </div>
          </RadioGroup>
        </div>

        <div v-if="feeMode === 'manual'" class="space-y-2">
          <Label>Custom fee percentage</Label>
          <div class="flex items-center gap-2">
            <Input
              v-model.number="customFeePercentage"
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="e.g. 5"
              class="h-10"
            />
            <span class="text-sm text-muted-foreground">%</span>
          </div>
        </div>

        <FeeCalculator
          :amount="amount || 0"
          :fee-mode="feeMode"
          :custom-fee-percentage="customFeePercentage"
          :currency="currency"
        />
      </div>

      <DialogFooter class="gap-2">
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="!canContinue" @click="handleCreate">
          Create & Share
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
