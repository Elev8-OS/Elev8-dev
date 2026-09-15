<script setup lang="ts">
import type { InvoiceTemplate } from '~/components/settings/data/invoice-templates'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import {
  createBlankInvoiceTemplate,
  DEFAULT_FOOTER_MESSAGE,
  DEFAULT_HEADER_MESSAGE,
} from '~/components/settings/data/invoice-templates'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Switch } from '~/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Textarea } from '~/components/ui/textarea'
import { useInvoiceTemplates } from '~/composables/useInvoiceTemplates'

const props = defineProps<{
  open: boolean
  templateToEdit?: InvoiceTemplate | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [template: InvoiceTemplate]
}>()

const { templates, createTemplate, updateTemplate } = useInvoiceTemplates()

const activeTab = ref<'company' | 'bank' | 'messages' | 'listings' | 'preview'>('company')
const listingSearch = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

// Draft state
const draft = ref<Omit<InvoiceTemplate, 'id' | 'createdAt' | 'updatedAt'>>(createBlankInvoiceTemplate())

watch(() => props.open, (isOpen) => {
  if (!isOpen)
    return
  activeTab.value = 'company'
  listingSearch.value = ''

  if (props.templateToEdit) {
    draft.value = JSON.parse(JSON.stringify({
      name: props.templateToEdit.name,
      isDefault: props.templateToEdit.isDefault,
      headerMessage: props.templateToEdit.headerMessage ?? DEFAULT_HEADER_MESSAGE,
      footerMessage: props.templateToEdit.footerMessage ?? DEFAULT_FOOTER_MESSAGE,
      company: { ...props.templateToEdit.company },
      bank: { ...props.templateToEdit.bank },
      assignedListingIds: [...props.templateToEdit.assignedListingIds],
    }))
  }
  else {
    draft.value = createBlankInvoiceTemplate()
  }
})

// Mapping of listings assigned to OTHER templates
const otherTemplateAssignments = computed(() => {
  const map: Record<string, string> = {}
  for (const t of templates.value) {
    if (props.templateToEdit && t.id === props.templateToEdit.id)
      continue
    for (const lid of t.assignedListingIds) {
      map[lid] = t.name
    }
  }
  return map
})

const filteredListings = computed(() => {
  const q = listingSearch.value.trim().toLowerCase()
  if (!q)
    return listings.value
  return listings.value.filter(l =>
    l.name.toLowerCase().includes(q)
    || l.location.toLowerCase().includes(q)
    || (l.tags && l.tags.some(t => t.toLowerCase().includes(q))),
  )
})

function toggleListing(listingId: string) {
  const current = draft.value.assignedListingIds
  if (current.includes(listingId)) {
    draft.value.assignedListingIds = current.filter(id => id !== listingId)
  }
  else {
    draft.value.assignedListingIds = [...current, listingId]
  }
}

function selectAllFiltered() {
  const idsToAdd = filteredListings.value.map(l => l.id)
  const set = new Set([...draft.value.assignedListingIds, ...idsToAdd])
  draft.value.assignedListingIds = Array.from(set)
}

function clearAllFiltered() {
  const idsToRemove = new Set(filteredListings.value.map(l => l.id))
  draft.value.assignedListingIds = draft.value.assignedListingIds.filter(id => !idsToRemove.has(id))
}

function handleLogoUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file)
    return

  if (file.size > 2 * 1024 * 1024) {
    toast.error('Logo file size must be less than 2MB')
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      draft.value.company.logoDataUrl = reader.result
    }
  }
  reader.readAsDataURL(file)
}

function removeLogo() {
  draft.value.company.logoDataUrl = ''
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function handleSave() {
  if (!draft.value.name.trim()) {
    toast.error('Please enter a template name')
    activeTab.value = 'company'
    return
  }
  if (!draft.value.company.companyName.trim()) {
    toast.error('Please enter a company name')
    activeTab.value = 'company'
    return
  }

  if (props.templateToEdit) {
    updateTemplate(props.templateToEdit.id, draft.value)
    const updated = templates.value.find(t => t.id === props.templateToEdit?.id)
    if (updated)
      emit('saved', updated)
    toast.success('Invoice template updated')
  }
  else {
    const created = createTemplate(draft.value)
    emit('saved', created)
    toast.success('Invoice template created')
  }

  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="max-w-3xl sm:max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
      <DialogHeader class="p-6 pb-4 border-b">
        <DialogTitle class="text-xl">
          {{ templateToEdit ? 'Edit Invoice Template' : 'Create Invoice Template' }}
        </DialogTitle>
        <DialogDescription>
          Configure company billing entity, VAT, bank transfer details, and assign listings.
        </DialogDescription>
      </DialogHeader>

      <Tabs v-model="activeTab" class="flex-1 flex flex-col min-h-0">
        <div class="px-6 pt-3 border-b bg-muted/20">
          <TabsList class="grid grid-cols-5 w-full">
            <TabsTrigger value="company">
              Company
            </TabsTrigger>
            <TabsTrigger value="bank">
              Bank Details
            </TabsTrigger>
            <TabsTrigger value="messages">
              Messages
            </TabsTrigger>
            <TabsTrigger value="listings">
              Listings ({{ draft.assignedListingIds.length }})
            </TabsTrigger>
            <TabsTrigger value="preview">
              Live Preview
            </TabsTrigger>
          </TabsList>
        </div>

        <div class="flex-1 overflow-y-auto p-6">
          <!-- TAB 1: COMPANY DETAILS -->
          <TabsContent value="company" class="mt-0 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1.5 sm:col-span-2">
                <Label for="template-name">Template Name <span class="text-destructive">*</span></Label>
                <Input
                  id="template-name"
                  v-model="draft.name"
                  placeholder="e.g. Elevate Schweiz GmbH (Europe)"
                />
                <p class="text-[11px] text-muted-foreground">
                  Internal display name used in dashboard lists and listing dropdowns.
                </p>
              </div>

              <div class="flex items-center justify-between sm:col-span-2 p-3 bg-muted/30 rounded-lg border">
                <div class="space-y-0.5">
                  <Label class="text-sm font-medium">Default Template</Label>
                  <p class="text-xs text-muted-foreground">
                    Automatically used for any reservation whose listing has no custom company assigned.
                  </p>
                </div>
                <Switch
                  :checked="draft.isDefault"
                  @update:checked="(val) => draft.isDefault = val"
                />
              </div>

              <div class="space-y-1.5 sm:col-span-2">
                <Label for="comp-name">Company Legal Name <span class="text-destructive">*</span></Label>
                <Input
                  id="comp-name"
                  v-model="draft.company.companyName"
                  placeholder="e.g. Elevate Schweiz GmbH"
                />
              </div>

              <div class="space-y-1.5">
                <Label for="comp-reg">Commercial Register no</Label>
                <Input
                  id="comp-reg"
                  v-model="draft.company.commercialRegisterNo"
                  placeholder="e.g. CHE-163.290.666"
                />
              </div>

              <div class="space-y-1.5">
                <Label for="comp-dir">Managing Director</Label>
                <Input
                  id="comp-dir"
                  v-model="draft.company.managingDirector"
                  placeholder="e.g. Marc Schneider"
                />
              </div>

              <div class="space-y-1.5 sm:col-span-2">
                <Label for="comp-addr">Address</Label>
                <Input
                  id="comp-addr"
                  v-model="draft.company.address"
                  placeholder="e.g. Im Fueler 7"
                />
              </div>

              <div class="space-y-1.5">
                <Label for="comp-postal">Postal Code & City</Label>
                <div class="flex gap-2">
                  <Input
                    id="comp-postal"
                    v-model="draft.company.postalCode"
                    class="w-28 shrink-0"
                    placeholder="4616"
                  />
                  <Input
                    v-model="draft.company.city"
                    class="flex-1"
                    placeholder="Kappel"
                  />
                </div>
              </div>

              <div class="space-y-1.5">
                <Label for="comp-reg-city">Registered City</Label>
                <Input
                  id="comp-reg-city"
                  v-model="draft.company.registeredCity"
                  placeholder="e.g. Kappel, Switzerland"
                />
              </div>

              <div class="space-y-1.5">
                <Label for="comp-email">Email</Label>
                <Input
                  id="comp-email"
                  v-model="draft.company.email"
                  type="email"
                  placeholder="e.g. hello@elevater.ch"
                />
              </div>

              <div class="space-y-1.5">
                <Label for="comp-vat">VAT Number / Tax ID</Label>
                <Input
                  id="comp-vat"
                  v-model="draft.company.vatNumber"
                  placeholder="e.g. CHE-163.290.666MWST"
                />
              </div>

              <div class="space-y-1.5">
                <Label for="comp-phone">Phone (optional)</Label>
                <Input
                  id="comp-phone"
                  v-model="draft.company.phone"
                  placeholder="e.g. +41 62 209 1100"
                />
              </div>

              <div class="space-y-1.5">
                <Label for="comp-web">Website (optional)</Label>
                <Input
                  id="comp-web"
                  v-model="draft.company.website"
                  placeholder="e.g. https://elevater.ch"
                />
              </div>

              <div class="space-y-2 sm:col-span-2 pt-2 border-t">
                <Label>Company Logo</Label>
                <div class="flex items-center gap-4">
                  <div
                    class="size-14 rounded border flex items-center justify-center bg-muted/40 overflow-hidden"
                  >
                    <img
                      v-if="draft.company.logoDataUrl"
                      :src="draft.company.logoDataUrl"
                      alt="Company Logo"
                      class="size-full object-contain p-1"
                    >
                    <Icon v-else name="lucide:image" class="size-6 text-muted-foreground/60" />
                  </div>

                  <div class="space-y-1">
                    <div class="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        @click="fileInputRef?.click()"
                      >
                        <Icon name="lucide:upload" class="mr-1.5 size-3.5" />
                        {{ draft.company.logoDataUrl ? 'Change Logo' : 'Upload Logo' }}
                      </Button>
                      <Button
                        v-if="draft.company.logoDataUrl"
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="text-destructive hover:text-destructive"
                        @click="removeLogo"
                      >
                        Remove
                      </Button>
                    </div>
                    <p class="text-[11px] text-muted-foreground">
                      PNG or JPEG up to 2MB. If omitted, the default Elev8 logo is used.
                    </p>
                  </div>
                  <input
                    ref="fileInputRef"
                    type="file"
                    accept="image/png, image/jpeg"
                    class="hidden"
                    @change="handleLogoUpload"
                  >
                </div>
              </div>
            </div>
          </TabsContent>

          <!-- TAB 2: BANK DETAILS -->
          <TabsContent value="bank" class="mt-0 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1.5 sm:col-span-2">
                <Label for="bank-name">Bank Name <span class="text-destructive">*</span></Label>
                <Input
                  id="bank-name"
                  v-model="draft.bank.bankName"
                  placeholder="e.g. Aargauische Kantonalbank or Bank Central Asia (BCA)"
                />
              </div>

              <div class="space-y-1.5 sm:col-span-2">
                <Label for="bank-holder">Bank Account Holder <span class="text-destructive">*</span></Label>
                <Input
                  id="bank-holder"
                  v-model="draft.bank.accountHolder"
                  placeholder="e.g. Elevate Schweiz GmbH"
                />
              </div>

              <div class="space-y-1.5 sm:col-span-2">
                <Label for="bank-iban">IBAN (International Bank Account Number)</Label>
                <Input
                  id="bank-iban"
                  v-model="draft.bank.iban"
                  placeholder="e.g. CH69 0076 1648 8692 1200 2"
                />
                <p class="text-[11px] text-muted-foreground">
                  Standard European bank format. If using local account numbers, fill Account Number below.
                </p>
              </div>

              <div class="space-y-1.5">
                <Label for="bank-acc">Account Number (Alternative)</Label>
                <Input
                  id="bank-acc"
                  v-model="draft.bank.accountNumber"
                  placeholder="e.g. 7890 1234 56"
                />
              </div>

              <div class="space-y-1.5">
                <Label for="bank-swift">BIC / SWIFT Code</Label>
                <Input
                  id="bank-swift"
                  v-model="draft.bank.bicSwift"
                  placeholder="e.g. KBAGCH22"
                />
              </div>
            </div>
          </TabsContent>

          <!-- TAB 3: HEADER & FOOTER MESSAGES -->
          <TabsContent value="messages" class="mt-0 space-y-5">
            <div class="space-y-1.5">
              <Label for="header-msg">Header Message</Label>
              <Textarea
                id="header-msg"
                v-model="draft.headerMessage"
                rows="3"
                placeholder="e.g. Thank you for choosing Us. Below you'll find the summary of your booking and payment details..."
              />
              <p class="text-[11px] text-muted-foreground">
                Printed in the invoice body above the items table.
              </p>
            </div>

            <div class="space-y-1.5">
              <Label for="footer-msg">Footer Message</Label>
              <Textarea
                id="footer-msg"
                v-model="draft.footerMessage"
                rows="3"
                placeholder="e.g. Please make payment within 7 days using booking ID as your reference. For any billing inquiries, contact us..."
              />
              <p class="text-[11px] text-muted-foreground">
                Printed at the bottom of the invoice below payment and bank details.
              </p>
            </div>
          </TabsContent>

          <!-- TAB 4: ASSIGNED LISTINGS -->
          <TabsContent value="listings" class="mt-0 space-y-3">
            <div class="flex items-center justify-between gap-3">
              <div class="relative flex-1">
                <Icon name="lucide:search" class="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  v-model="listingSearch"
                  placeholder="Search listings by title or location..."
                  class="pl-9 h-9"
                />
              </div>
              <div class="flex gap-2">
                <Button type="button" variant="outline" size="sm" @click="selectAllFiltered">
                  Select All
                </Button>
                <Button type="button" variant="ghost" size="sm" @click="clearAllFiltered">
                  Clear
                </Button>
              </div>
            </div>

            <ScrollArea class="h-80 border rounded-lg p-2">
              <div class="space-y-1">
                <div
                  v-for="listing in filteredListings"
                  :key="listing.id"
                  class="flex items-center justify-between p-2.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                  :class="draft.assignedListingIds.includes(listing.id) ? 'bg-primary/5 border border-primary/20' : ''"
                  @click="toggleListing(listing.id)"
                >
                  <div class="flex items-center gap-3">
                    <input
                      type="checkbox"
                      :checked="draft.assignedListingIds.includes(listing.id)"
                      class="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                      @click.stop="toggleListing(listing.id)"
                    >
                    <img
                      v-if="listing.photos?.[0]"
                      :src="listing.photos[0]"
                      class="size-9 rounded object-cover"
                      alt=""
                    >
                    <div>
                      <p class="text-sm font-medium leading-none">
                        {{ listing.name }}
                      </p>
                      <p class="text-xs text-muted-foreground mt-1">
                        {{ listing.location }} · {{ listing.capacity }} guests
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <Badge
                      v-if="otherTemplateAssignments[listing.id]"
                      variant="outline"
                      class="text-[10px] text-amber-600 dark:text-amber-400 border-amber-300"
                    >
                      Assigned to: {{ otherTemplateAssignments[listing.id] }}
                    </Badge>
                    <Badge
                      v-if="draft.assignedListingIds.includes(listing.id)"
                      class="bg-emerald-600 text-white hover:bg-emerald-600"
                    >
                      Selected
                    </Badge>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <p class="text-xs text-muted-foreground">
              Total assigned: <span class="font-bold text-foreground">{{ draft.assignedListingIds.length }}</span> listings. If a listing was previously on another company template, saving will transfer it here.
            </p>
          </TabsContent>

          <!-- TAB 5: LIVE PREVIEW -->
          <TabsContent value="preview" class="mt-0">
            <div class="rounded-lg border bg-white p-6 text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100 font-sans text-xs space-y-4">
              <!-- Top Row: Company Info & Logo -->
              <div class="flex justify-between items-start gap-4 pb-4 border-b border-border/40">
                <div class="space-y-0.5 max-w-[60%]">
                  <h4 class="font-bold text-sm text-foreground">
                    {{ draft.company.companyName || 'COMPANY NAME' }}
                  </h4>
                  <p v-if="draft.company.address" class="text-muted-foreground">
                    {{ draft.company.address }}
                  </p>
                  <p v-if="draft.company.postalCode || draft.company.city" class="text-muted-foreground">
                    {{ draft.company.postalCode }} {{ draft.company.city }}
                  </p>
                  <p v-if="draft.company.commercialRegisterNo || draft.company.registeredCity" class="text-[11px] text-muted-foreground">
                    Reg: {{ draft.company.commercialRegisterNo || '—' }} · {{ draft.company.registeredCity || '' }}
                  </p>
                  <p v-if="draft.company.managingDirector" class="text-[11px] text-muted-foreground">
                    Managing Director: {{ draft.company.managingDirector }}
                  </p>
                  <p v-if="draft.company.email" class="text-[11px] text-muted-foreground">
                    Email: {{ draft.company.email }}
                  </p>
                  <p v-if="draft.company.vatNumber" class="text-[11px] font-medium text-foreground">
                    {{ draft.company.vatNumber }}
                  </p>
                </div>

                <div class="text-right space-y-1">
                  <img
                    v-if="draft.company.logoDataUrl"
                    :src="draft.company.logoDataUrl"
                    alt="Logo"
                    class="h-9 max-w-36 object-contain ml-auto"
                  >
                  <div v-else class="flex items-center gap-1.5 justify-end text-sm font-bold text-foreground">
                    <span class="size-5 rounded bg-slate-900 text-[9px] font-black text-white flex items-center justify-center">E8</span>
                    Elev8
                  </div>
                  <p class="font-bold text-sm text-foreground pt-1">
                    Tax Invoice / Receipt
                  </p>
                  <p class="text-[11px] text-muted-foreground">
                    Invoice # 3189
                  </p>
                </div>
              </div>

              <!-- Date & Invoiced To -->
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1">
                  <p class="font-bold text-foreground">
                    Tuesday, 15 September 2026
                  </p>
                  <div class="flex items-start gap-2 pt-1">
                    <span class="font-bold text-foreground shrink-0">Invoiced To:</span>
                    <div>
                      <p class="font-bold uppercase">
                        Bruce Springsteen
                      </p>
                      <p class="text-muted-foreground">
                        Villa Serenity · Canggu, Bali
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Header Message -->
              <div v-if="draft.headerMessage" class="p-2.5 bg-muted/40 rounded border text-[11px] text-muted-foreground italic">
                "{{ draft.headerMessage }}"
              </div>

              <!-- Items Table Sample -->
              <div class="border rounded overflow-hidden">
                <div class="bg-slate-300 dark:bg-slate-700 px-3 py-1.5 text-[11px] font-bold text-slate-900 dark:text-slate-100 flex justify-between">
                  <span>Item</span>
                  <div class="flex gap-8">
                    <span class="w-16 text-right">Tax / Svc</span>
                    <span class="w-16 text-right">Cost</span>
                  </div>
                </div>
                <div class="divide-y divide-border/60">
                  <div class="p-2.5 flex justify-between items-center text-xs">
                    <div>
                      <p class="font-medium text-foreground">
                        Accommodation - 3 nights
                      </p>
                      <p class="text-[10px] text-muted-foreground">
                        Villa Serenity · Paid via Airbnb
                      </p>
                    </div>
                    <div class="flex gap-8 text-right">
                      <span class="w-16 text-muted-foreground">$75.00</span>
                      <span class="w-16 font-medium text-foreground">$750.00</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Totals -->
              <div class="flex flex-col items-end gap-1 text-xs pt-1">
                <div class="flex justify-between gap-6 text-muted-foreground">
                  <span>Includes Tax</span>
                  <span class="w-16 text-right font-medium text-foreground">$54.50</span>
                </div>
                <div class="flex justify-between gap-6 text-muted-foreground">
                  <span>Includes Service Charge</span>
                  <span class="w-16 text-right font-medium text-foreground">$27.25</span>
                </div>
                <div class="flex justify-between gap-6 pt-1 text-sm font-bold text-foreground">
                  <span>TOTAL PAID</span>
                  <span class="w-16 text-right">$750.00</span>
                </div>
              </div>

              <!-- Bank Details & Status -->
              <div class="grid grid-cols-2 gap-4 pt-3 border-t border-border/60">
                <div class="space-y-0.5 text-[11px]">
                  <p class="font-bold text-foreground">
                    Bank Transfer Details
                  </p>
                  <p class="text-muted-foreground">
                    Bank: {{ draft.bank.bankName || 'Aargauische Kantonalbank' }}
                  </p>
                  <p class="text-muted-foreground">
                    Account Holder: {{ draft.bank.accountHolder || draft.company.companyName || 'Elevate Schweiz GmbH' }}
                  </p>
                  <p v-if="draft.bank.iban" class="text-muted-foreground">
                    IBAN: {{ draft.bank.iban }}
                  </p>
                  <p v-if="draft.bank.accountNumber" class="text-muted-foreground">
                    Account No: {{ draft.bank.accountNumber }}
                  </p>
                  <p v-if="draft.bank.bicSwift" class="text-muted-foreground">
                    BIC/SWIFT: {{ draft.bank.bicSwift }}
                  </p>
                  <p class="text-muted-foreground">
                    Reference: 3189
                  </p>
                </div>

                <div class="text-right space-y-2">
                  <div class="inline-block bg-slate-300 dark:bg-slate-700 px-3 py-1 font-bold text-[10px] text-slate-900 dark:text-slate-100 rounded">
                    Payment Method: Airbnb (Prepaid)
                  </div>
                  <div>
                    <p class="text-base font-black tracking-tight text-foreground">
                      PAID IN FULL
                    </p>
                    <p class="text-[10px] text-muted-foreground">
                      on 15/09/2026
                    </p>
                  </div>
                </div>
              </div>

              <!-- Footer Message -->
              <div v-if="draft.footerMessage" class="pt-3 border-t border-border/40 text-[11px] text-muted-foreground">
                {{ draft.footerMessage }}
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <DialogFooter class="p-4 border-t bg-muted/20 flex sm:justify-between items-center">
        <div class="text-xs text-muted-foreground">
          <span v-if="draft.isDefault" class="font-medium text-emerald-600 flex items-center gap-1">
            <Icon name="lucide:check-circle" class="size-3.5" />
            Set as default billing entity
          </span>
        </div>
        <div class="flex gap-2">
          <Button type="button" variant="outline" @click="emit('update:open', false)">
            Cancel
          </Button>
          <Button type="button" @click="handleSave">
            {{ templateToEdit ? 'Save Changes' : 'Create Template' }}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
