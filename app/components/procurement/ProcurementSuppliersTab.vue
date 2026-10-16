<script setup lang="ts">
import type { Supplier, SupplierCategory } from '@/components/procurement/data/suppliers'
import { toast } from 'vue-sonner'
import { SUPPLIER_CATEGORIES } from '@/components/procurement/data/suppliers'
import { useSuppliers } from '@/composables/useSuppliers'
import BaseSearchInput from '~/components/base/SearchInput.vue'

const {
  filteredSuppliers,
  searchValue,
  activeCategoryFilter,
  deleteSupplier,
} = useSuppliers()

const drawerOpen = ref(false)
const selectedSupplier = ref<Supplier | null>(null)

function openAdd() {
  selectedSupplier.value = null
  drawerOpen.value = true
}

function openEdit(sup: Supplier) {
  selectedSupplier.value = sup
  drawerOpen.value = true
}

function handleDelete(sup: Supplier) {
  deleteSupplier(sup.id)
  toast.success(`"${sup.name}" deleted`)
}

const CATEGORY_OPTIONS: { value: SupplierCategory | 'all', label: string }[] = [
  { value: 'all', label: 'All' },
  ...SUPPLIER_CATEGORIES.map(c => ({ value: c as SupplierCategory, label: c })),
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2">
      <BaseSearchInput v-model="searchValue" placeholder="Search suppliers..." class="sm:w-48" />

      <div class="flex flex-wrap gap-1.5">
        <Button
          v-for="cat in CATEGORY_OPTIONS"
          :key="cat.value"
          :variant="activeCategoryFilter === cat.value ? 'default' : 'outline'"
          size="sm"
          class="h-8"
          @click="activeCategoryFilter = cat.value"
        >
          {{ cat.label }}
        </Button>
      </div>

      <div class="ml-auto">
        <Button size="sm" @click="openAdd">
          <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </div>
    </div>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Bank</TableHead>
            <TableHead class="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="sup in filteredSuppliers"
            :key="sup.id"
            class="cursor-pointer"
            @click="openEdit(sup)"
          >
            <TableCell class="font-medium">
              {{ sup.name }}
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ sup.contact }}
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ sup.email ?? '-' }}
            </TableCell>
            <TableCell>
              <Badge v-if="sup.category" variant="outline">
                {{ sup.category }}
              </Badge>
              <span v-else class="text-muted-foreground">-</span>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ sup.bankName ?? '-' }}
            </TableCell>
            <TableCell @click.stop>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-8 w-8">
                    <Icon name="lucide:ellipsis" class="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="openEdit(sup)">
                    <Icon name="lucide:pencil" class="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem class="text-destructive" @click="handleDelete(sup)">
                    <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
          <TableRow v-if="filteredSuppliers.length === 0">
            <TableCell colspan="6" class="text-center text-muted-foreground py-10">
              No suppliers found.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <ProcurementSupplierDrawer v-model:open="drawerOpen" :supplier="selectedSupplier" />
  </div>
</template>
