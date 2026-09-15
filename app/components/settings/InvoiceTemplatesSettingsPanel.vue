<script setup lang="ts">
import type { InvoiceTemplate } from '~/components/settings/data/invoice-templates'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import InvoiceTemplateAssignDialog from '~/components/settings/InvoiceTemplateAssignDialog.vue'
import InvoiceTemplateDialog from '~/components/settings/InvoiceTemplateDialog.vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Input } from '~/components/ui/input'
import { useInvoiceTemplates } from '~/composables/useInvoiceTemplates'

const {
  templates,
  getDefaultTemplate,
  setDefaultTemplate,
  deleteTemplate,
  duplicateTemplate,
} = useInvoiceTemplates()

const searchQuery = ref('')
const dialogOpen = ref(false)
const editingTemplate = ref<InvoiceTemplate | null>(null)

const assignDialogOpen = ref(false)
const assigningTemplate = ref<InvoiceTemplate | null>(null)

const deleteTarget = ref<InvoiceTemplate | null>(null)
const deleteDialogOpen = ref(false)

const totalListingsCount = computed(() => listings.value.length)

const assignedListingsCount = computed(() => {
  const set = new Set<string>()
  for (const t of templates.value) {
    for (const lid of t.assignedListingIds) {
      set.add(lid)
    }
  }
  return set.size
})

const unassignedCount = computed(() =>
  Math.max(0, totalListingsCount.value - assignedListingsCount.value),
)

const filteredTemplates = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q)
    return templates.value
  return templates.value.filter(t =>
    t.name.toLowerCase().includes(q)
    || t.company.companyName.toLowerCase().includes(q)
    || (t.company.vatNumber && t.company.vatNumber.toLowerCase().includes(q))
    || (t.bank.bankName && t.bank.bankName.toLowerCase().includes(q))
    || (t.bank.iban && t.bank.iban.toLowerCase().includes(q))
    || (t.bank.accountNumber && t.bank.accountNumber.toLowerCase().includes(q)),
  )
})

function getListingName(id: string): string {
  const l = listings.value.find(item => item.id === id)
  return l ? l.name : id
}

function openCreate() {
  editingTemplate.value = null
  dialogOpen.value = true
}

function openEdit(t: InvoiceTemplate) {
  editingTemplate.value = t
  dialogOpen.value = true
}

function openAssign(t: InvoiceTemplate) {
  assigningTemplate.value = t
  assignDialogOpen.value = true
}

function handleMakeDefault(t: InvoiceTemplate) {
  setDefaultTemplate(t.id)
  toast.success(`"${t.name}" is now the default invoice template`)
}

function handleDuplicate(t: InvoiceTemplate) {
  const copy = duplicateTemplate(t.id)
  if (copy) {
    toast.success(`Duplicated template as "${copy.name}"`)
  }
}

function confirmDelete(t: InvoiceTemplate) {
  if (t.isDefault) {
    toast.error('Cannot delete the default template. Set another template as default first.')
    return
  }
  if (templates.value.length <= 1) {
    toast.error('Cannot delete the only template.')
    return
  }
  deleteTarget.value = t
  deleteDialogOpen.value = true
}

function executeDelete() {
  if (!deleteTarget.value)
    return
  const name = deleteTarget.value.name
  const ok = deleteTemplate(deleteTarget.value.id)
  deleteDialogOpen.value = false
  if (ok) {
    toast.success(`Template "${name}" deleted`)
  }
  else {
    toast.error('Failed to delete template')
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Invoice Templates
        </h2>
        <p class="text-sm text-muted-foreground mt-1">
          Create company billing entities, VAT IDs, and bank details, and assign them to listings for guest invoices.
        </p>
      </div>

      <Button class="shrink-0" @click="openCreate">
        <Icon name="lucide:plus" class="mr-1.5 size-4" />
        Create Template
      </Button>
    </div>

    <!-- Summary Metrics -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="p-4 space-y-1">
        <p class="text-xs font-medium text-muted-foreground">
          Total Templates
        </p>
        <p class="text-2xl font-bold">
          {{ templates.length }}
        </p>
        <p class="text-[11px] text-muted-foreground">
          Billing entities configured
        </p>
      </Card>

      <Card class="p-4 space-y-1">
        <p class="text-xs font-medium text-muted-foreground">
          Default Entity
        </p>
        <p class="text-sm font-bold truncate">
          {{ getDefaultTemplate()?.company.companyName || 'None' }}
        </p>
        <p class="text-[11px] text-muted-foreground">
          Fallback for unassigned listings
        </p>
      </Card>

      <Card class="p-4 space-y-1">
        <p class="text-xs font-medium text-muted-foreground">
          Assigned Listings
        </p>
        <p class="text-2xl font-bold text-emerald-600">
          {{ assignedListingsCount }} / {{ totalListingsCount }}
        </p>
        <p class="text-[11px] text-muted-foreground">
          Explicitly mapped properties
        </p>
      </Card>

      <Card class="p-4 space-y-1">
        <p class="text-xs font-medium text-muted-foreground">
          Using Default
        </p>
        <p class="text-2xl font-bold text-slate-700 dark:text-slate-300">
          {{ unassignedCount }}
        </p>
        <p class="text-[11px] text-muted-foreground">
          Properties using default company
        </p>
      </Card>
    </div>

    <!-- Filter Bar -->
    <div class="flex items-center gap-3">
      <div class="relative flex-1 max-w-md">
        <Icon name="lucide:search" class="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          placeholder="Search templates by company, bank, VAT, or name..."
          class="pl-9 h-9"
        />
      </div>
      <Badge variant="outline" class="h-9 px-3 text-xs">
        {{ filteredTemplates.length }} template{{ filteredTemplates.length === 1 ? '' : 's' }}
      </Badge>
    </div>

    <!-- Templates Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <Card
        v-for="tmpl in filteredTemplates"
        :key="tmpl.id"
        class="relative flex flex-col justify-between overflow-hidden border hover:border-border/80 transition-all shadow-sm"
        :class="tmpl.isDefault ? 'border-primary/40 bg-primary/[0.01]' : ''"
      >
        <div>
          <CardHeader class="p-5 pb-3">
            <div class="flex items-start justify-between gap-3">
              <div class="space-y-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <CardTitle class="text-base font-bold truncate">
                    {{ tmpl.name }}
                  </CardTitle>
                  <Badge
                    v-if="tmpl.isDefault"
                    class="bg-emerald-600 text-white hover:bg-emerald-600 text-[10px] h-5"
                  >
                    Default
                  </Badge>
                </div>
                <CardDescription class="font-medium text-foreground text-xs">
                  {{ tmpl.company.companyName }}
                </CardDescription>
              </div>

              <!-- More Dropdown -->
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-8 shrink-0 -mr-2">
                    <Icon name="lucide:more-vertical" class="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="openEdit(tmpl)">
                    <Icon name="lucide:edit" class="mr-2 size-4" />
                    Edit Template
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="openAssign(tmpl)">
                    <Icon name="lucide:home" class="mr-2 size-4" />
                    Assign Listings
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="handleDuplicate(tmpl)">
                    <Icon name="lucide:copy" class="mr-2 size-4" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    :disabled="tmpl.isDefault"
                    @click="handleMakeDefault(tmpl)"
                  >
                    <Icon name="lucide:check-circle" class="mr-2 size-4" />
                    Set as Default
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    :disabled="tmpl.isDefault || templates.length <= 1"
                    class="text-destructive focus:text-destructive"
                    @click="confirmDelete(tmpl)"
                  >
                    <Icon name="lucide:trash-2" class="mr-2 size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>

          <CardContent class="p-5 pt-0 space-y-4">
            <!-- Company & Bank Details Summary -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-lg bg-muted/40 text-xs">
              <div class="space-y-1">
                <p class="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Company Info
                </p>
                <p v-if="tmpl.company.vatNumber" class="font-medium">
                  {{ tmpl.company.vatNumber }}
                </p>
                <p v-if="tmpl.company.commercialRegisterNo" class="text-muted-foreground truncate">
                  Reg: {{ tmpl.company.commercialRegisterNo }}
                </p>
                <p v-if="tmpl.company.managingDirector" class="text-muted-foreground truncate">
                  Director: {{ tmpl.company.managingDirector }}
                </p>
                <p v-if="tmpl.company.city" class="text-muted-foreground truncate">
                  {{ tmpl.company.postalCode }} {{ tmpl.company.city }}
                </p>
              </div>

              <div class="space-y-1">
                <p class="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Bank Details
                </p>
                <p class="font-medium truncate">
                  {{ tmpl.bank.bankName }}
                </p>
                <p v-if="tmpl.bank.iban" class="text-muted-foreground truncate font-mono text-[11px]">
                  IBAN: {{ tmpl.bank.iban }}
                </p>
                <p v-else-if="tmpl.bank.accountNumber" class="text-muted-foreground truncate font-mono text-[11px]">
                  Acc: {{ tmpl.bank.accountNumber }}
                </p>
                <p v-if="tmpl.bank.bicSwift" class="text-muted-foreground text-[11px]">
                  BIC: {{ tmpl.bank.bicSwift }}
                </p>
              </div>
            </div>

            <!-- Assigned Listings Summary -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-medium text-muted-foreground">Assigned Listings ({{ tmpl.assignedListingIds.length }})</span>
                <Button
                  variant="link"
                  size="sm"
                  class="h-auto p-0 text-xs"
                  @click="openAssign(tmpl)"
                >
                  Manage
                </Button>
              </div>

              <div v-if="tmpl.assignedListingIds.length > 0" class="flex flex-wrap gap-1.5">
                <Badge
                  v-for="lid in tmpl.assignedListingIds.slice(0, 4)"
                  :key="lid"
                  variant="secondary"
                  class="text-[11px] font-normal"
                >
                  {{ getListingName(lid) }}
                </Badge>
                <Badge
                  v-if="tmpl.assignedListingIds.length > 4"
                  variant="outline"
                  class="text-[11px] font-normal text-muted-foreground"
                >
                  +{{ tmpl.assignedListingIds.length - 4 }} more
                </Badge>
              </div>
              <p v-else class="text-xs text-muted-foreground italic">
                {{ tmpl.isDefault ? 'Used automatically for all unassigned listings.' : 'No listings currently assigned.' }}
              </p>
            </div>
          </CardContent>
        </div>

        <!-- Card Footer Actions -->
        <div class="p-5 pt-0 flex items-center justify-between border-t border-border/50 mt-4 pt-3">
          <span class="text-[11px] text-muted-foreground">
            {{ tmpl.headerMessage ? 'Header message enabled' : 'Standard header' }}
          </span>

          <div class="flex gap-2">
            <Button variant="outline" size="sm" class="h-8 text-xs" @click="openAssign(tmpl)">
              <Icon name="lucide:home" class="mr-1.5 size-3.5" />
              Assign
            </Button>
            <Button size="sm" class="h-8 text-xs" @click="openEdit(tmpl)">
              <Icon name="lucide:edit-3" class="mr-1.5 size-3.5" />
              Edit
            </Button>
          </div>
        </div>
      </Card>
    </div>

    <!-- Modals -->
    <InvoiceTemplateDialog
      v-model:open="dialogOpen"
      :template-to-edit="editingTemplate"
    />

    <InvoiceTemplateAssignDialog
      v-model:open="assignDialogOpen"
      :template="assigningTemplate"
    />

    <!-- Delete Confirmation Dialog -->
    <AlertDialog :open="deleteDialogOpen" @update:open="(val) => deleteDialogOpen = val">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Invoice Template</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <span class="font-bold text-foreground">"{{ deleteTarget?.name }}"</span>?
            Any listings assigned to this template will automatically fall back to the default invoice template.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="executeDelete"
          >
            Delete Template
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
