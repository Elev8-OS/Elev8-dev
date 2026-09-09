<script setup lang="ts">
import type { UpsellService } from '@/components/upsells/data/upsell-services'
import { toast } from 'vue-sonner'
import { serviceGrantsLockAccess } from '@/components/upsells/data/lock-access'
import { useUpsellServices } from '@/composables/useUpsellServices'

const emit = defineEmits<{
  openDrawer: [service: UpsellService | null]
}>()

const { filteredServices, toggleStatus, deleteService } = useUpsellServices()

function openEdit(service: UpsellService) {
  emit('openDrawer', service)
}

function handleToggleStatus(id: string) {
  toggleStatus(id)
  toast.success('Service status updated.')
}

function handleDelete(id: string) {
  deleteService(id)
  toast.success('Service deleted.')
}

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString('id-ID')}`
}

function priceRange(svc: UpsellService) {
  if (svc.items.length === 0)
    return '—'
  const prices = svc.items.map(i => i.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (min === max)
    return formatPrice(min, svc.currency)
  return `${formatPrice(min, svc.currency)} – ${formatPrice(max, svc.currency).replace(`${svc.currency} `, '')}`
}

/** Lock access is an attribute, not a category, so it rides alongside the name as a badge. */
function lockAccessLabel(svc: UpsellService) {
  const names = svc.lockAccess?.lockNames ?? []
  return names.length > 0 ? `Issues a code for ${names.join(', ')} on payment` : ''
}

const categoryBadgeClass: Record<string, string> = {
  'Airport Transport': 'text-violet-700 bg-violet-50',
  'Vehicle Rental': 'text-slate-700 bg-slate-100',
  'Private Chef': 'text-amber-700 bg-amber-50',
  'Spa': 'text-pink-700 bg-pink-50',
  'Activity': 'text-emerald-700 bg-emerald-50',
  'Late Check-out': 'text-indigo-700 bg-indigo-50',
  'Early Check-in': 'text-sky-700 bg-sky-50',
  'Mid-stay Cleaning': 'text-teal-700 bg-teal-50',
  'Office Equipment': 'text-orange-700 bg-orange-50',
  'Baby': 'text-rose-700 bg-rose-50',
  'Pet': 'text-lime-700 bg-lime-50',
  'Miscellaneous': 'text-gray-700 bg-gray-100',
}
</script>

<template>
  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-12" />
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead class="text-right">
            Price Range
          </TableHead>
          <TableHead class="text-center">
            Items
          </TableHead>
          <TableHead class="text-center">
            Listings
          </TableHead>
          <TableHead class="text-center">
            Availability
          </TableHead>
          <TableHead class="text-center">
            Status
          </TableHead>
          <TableHead class="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-if="filteredServices.length === 0">
          <TableCell colspan="9" class="py-12 text-center text-sm text-muted-foreground">
            No upsell services match the selected filters.
          </TableCell>
        </TableRow>
        <TableRow
          v-for="svc in filteredServices"
          v-else
          :key="svc.id"
          class="cursor-pointer hover:bg-muted/50"
          @click="openEdit(svc)"
        >
          <TableCell>
            <div class="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <Icon name="lucide:image" class="h-5 w-5 text-muted-foreground" />
            </div>
          </TableCell>
          <TableCell>
            <div class="flex items-center gap-1.5">
              <p class="font-medium">
                {{ svc.name }}
              </p>
              <TooltipProvider v-if="serviceGrantsLockAccess(svc)">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span
                      class="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 p-1 text-amber-700"
                      :aria-label="lockAccessLabel(svc)"
                    >
                      <Icon name="lucide:key-round" class="size-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {{ lockAccessLabel(svc) }}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p class="max-w-64 truncate text-xs text-muted-foreground">
              {{ svc.description }}
            </p>
          </TableCell>
          <TableCell>
            <span
              class="rounded-full px-2.5 py-0.5 text-xs font-medium"
              :class="categoryBadgeClass[svc.category] ?? 'text-gray-700 bg-gray-100'"
            >
              {{ svc.category }}
            </span>
          </TableCell>
          <TableCell class="text-right font-semibold tabular-nums whitespace-nowrap">
            {{ priceRange(svc) }}
          </TableCell>
          <TableCell class="text-center">
            <Badge variant="secondary">
              {{ svc.items.length }} {{ svc.items.length === 1 ? 'item' : 'items' }}
            </Badge>
          </TableCell>
          <TableCell class="text-center">
            <Badge variant="secondary">
              {{ svc.assignedListings.length }} {{ svc.assignedListings.length === 1 ? 'listing' : 'listings' }}
            </Badge>
          </TableCell>
          <TableCell class="text-center">
            <Badge :variant="svc.availability === 'always' ? 'default' : 'outline'" class="gap-1">
              <Icon
                :name="svc.availability === 'always' ? 'lucide:shopping-cart' : 'lucide:clock'"
                class="h-3 w-3"
              />
              {{ svc.availability === 'always' ? 'Always' : 'By Request' }}
            </Badge>
          </TableCell>
          <TableCell class="text-center">
            <Badge :variant="svc.status === 'active' ? 'default' : 'secondary'">
              {{ svc.status === 'active' ? 'Active' : 'Inactive' }}
            </Badge>
          </TableCell>
          <TableCell @click.stop>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon" class="h-7 w-7" aria-label="Row actions">
                  <Icon name="lucide:ellipsis" class="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="openEdit(svc)">
                  <Icon name="lucide:pencil" class="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem @click="handleToggleStatus(svc.id)">
                  <Icon
                    :name="svc.status === 'active' ? 'lucide:eye-off' : 'lucide:eye'"
                    class="mr-2 h-4 w-4"
                  />
                  {{ svc.status === 'active' ? 'Deactivate' : 'Activate' }}
                </DropdownMenuItem>
                <DropdownMenuItem class="text-destructive" @click="handleDelete(svc.id)">
                  <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
