<script setup lang="ts">
import type { PetPolicy } from '~/components/listings/data/pet-policy'
import type { UpsellService } from '~/components/upsells/data/upsell-services'
import { useUpsellServices } from '~/composables/useUpsellServices'

/**
 * Pets allowed at a listing, and the pet packages guests choose from when
 * they declare a pet. Packages are the upsell catalog's Pet services; the
 * catalog stays the source of their prices and of which listings offer them.
 * Every change is emitted at once; the tab saves it onto the listing.
 */
const props = defineProps<{ policy: PetPolicy, listingName: string }>()
const emit = defineEmits<{ change: [policy: PetPolicy] }>()

const { services } = useUpsellServices()

const petServices = computed(() => services.value.filter(s => s.category === 'Pet'))
const packages = computed(() => props.policy.packageIds
  .map(id => services.value.find(s => s.id === id))
  .filter((s): s is UpsellService => Boolean(s)))

function set(patch: Partial<PetPolicy>) {
  emit('change', { ...props.policy, ...patch })
}

function toggleAllowed() {
  set({ allowed: !props.policy.allowed })
}

function togglePackage(id: string) {
  const ids = props.policy.packageIds
  set({ packageIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] })
}

/** A package the catalog does not offer on this listing would never reach its guests. */
function notOffered(service: UpsellService) {
  return service.status !== 'active' || !service.assignedListings.includes(props.listingName)
}

function priceRange(service: UpsellService) {
  const prices = service.items.map(i => i.price)
  if (!prices.length)
    return null
  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: service.currency === 'IDR' ? 0 : 2, minimumFractionDigits: service.currency === 'IDR' ? 0 : 2 })
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? `${service.currency} ${fmt(min)}` : `${service.currency} ${fmt(min)} to ${fmt(max)}`
}

const pickerOpen = ref(false)
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="pet-policy">
    <div class="flex items-center gap-3">
      <Switch
        :model-value="policy.allowed"
        aria-label="Pets allowed"
        data-testid="pets-allowed"
        @update:model-value="set({ allowed: Boolean($event) })"
      />
      <span class="cursor-pointer text-sm font-semibold" @click="toggleAllowed">Pets Allowed</span>
    </div>

    <p v-if="!policy.allowed" class="text-sm text-muted-foreground" data-testid="pets-not-allowed">
      Pets are not allowed at this listing.
    </p>

    <template v-else>
      <p v-if="!packages.length" class="text-sm text-muted-foreground" data-testid="pets-no-packages">
        No pet packages assigned. Guests who bring pets will still be asked to declare them, but no package selection or payment will be required.
      </p>

      <div v-else class="flex flex-col divide-y rounded-lg border" data-testid="pet-packages">
        <div v-for="service in packages" :key="service.id" class="flex items-start gap-3 p-3" data-testid="pet-package">
          <div class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10 text-primary">
            <img v-if="service.image" :src="service.image" alt="" class="size-full object-cover">
            <Icon v-else name="lucide:paw-print" class="size-4" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">
              {{ service.name }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ service.items.length }} {{ service.items.length === 1 ? 'option' : 'options' }}<template v-if="priceRange(service)">
                , {{ priceRange(service) }}
              </template>
            </p>
            <p v-if="notOffered(service)" class="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300" data-testid="pet-package-not-offered">
              <Icon name="lucide:triangle-alert" class="size-3.5" />
              {{ service.status !== 'active' ? 'Inactive in the upsell catalog.' : 'Not offered on this listing in the upsell catalog.' }}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="size-8 shrink-0 text-muted-foreground hover:text-destructive"
            :aria-label="`Remove ${service.name}`"
            @click="togglePackage(service.id)"
          >
            <Icon name="lucide:x" class="size-4" />
          </Button>
        </div>
      </div>

      <Popover v-model:open="pickerOpen">
        <PopoverTrigger as-child>
          <Button variant="outline" class="w-full gap-1.5" data-testid="assign-pet-upsell">
            <Icon name="lucide:plus" class="size-4" />
            Assign Pets Upsell
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" class="w-80 p-0">
          <div class="border-b px-3 py-2 text-sm font-semibold">
            Pet packages
          </div>
          <div class="max-h-64 overflow-y-auto p-1">
            <div
              v-for="service in petServices"
              :key="service.id"
              class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
              data-testid="pet-upsell-option"
              @click="togglePackage(service.id)"
            >
              <div
                class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                :class="policy.packageIds.includes(service.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
              >
                <Icon v-if="policy.packageIds.includes(service.id)" name="lucide:check" class="size-3" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm">
                  {{ service.name }}
                </p>
                <p class="truncate text-xs text-muted-foreground">
                  {{ priceRange(service) ?? 'No price' }}
                </p>
              </div>
            </div>
            <p v-if="!petServices.length" class="px-2 py-4 text-center text-xs text-muted-foreground">
              No upsells in the Pet category yet.
            </p>
          </div>
          <div class="border-t p-1">
            <Button variant="ghost" size="sm" class="h-8 w-full justify-start gap-2 text-xs" as-child>
              <NuxtLink to="/upsells">
                <Icon name="lucide:shopping-bag" class="size-3.5" />
                Manage upsells
              </NuxtLink>
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </template>
  </div>
</template>
