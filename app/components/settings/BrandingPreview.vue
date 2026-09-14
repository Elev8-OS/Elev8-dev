<script setup lang="ts">
import type { TenantBranding } from '~/components/settings/data/branding'
import { computed } from 'vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getBrandingFaviconHref, resolveInvoiceLogo } from '~/components/settings/data/branding'
import { buildGuestGuideCssVariables } from '~/lib/branding-colors'

const props = defineProps<{ branding: TenantBranding }>()
const guideStyle = computed(() => buildGuestGuideCssVariables(props.branding.guestGuideColors))
const invoiceLogo = computed(() => resolveInvoiceLogo(props.branding))
const faviconHref = computed(() => getBrandingFaviconHref(props.branding))
</script>

<template>
  <div class="rounded-lg border bg-card p-4">
    <div class="mb-4">
      <h3 class="font-medium">
        Live preview
      </h3>
      <p class="text-sm text-muted-foreground">
        Preview unsaved branding changes.
      </p>
    </div>

    <Tabs default-value="dashboard">
      <TabsList class="grid w-full grid-cols-3">
        <TabsTrigger value="dashboard">
          Dashboard
        </TabsTrigger>
        <TabsTrigger value="guide">
          Guest Guide
        </TabsTrigger>
        <TabsTrigger value="invoice">
          Invoice
        </TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard" class="mt-4">
        <div class="overflow-hidden rounded-lg border bg-background">
          <div class="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 text-xs">
            <img v-if="branding.favicon" :src="faviconHref" alt="Favicon preview" class="size-4 object-contain">
            <Icon v-else name="lucide:layout-dashboard" class="size-4" />
            <span>Elev8 Dashboard</span>
          </div>
          <div class="flex min-h-48">
            <aside class="w-40 border-r bg-sidebar p-3 text-sidebar-foreground">
              <div class="flex items-center gap-2">
                <div class="flex size-8 items-center justify-center rounded-lg border bg-background p-1">
                  <img v-if="branding.primaryLogo" :src="branding.primaryLogo.dataUrl" alt="Primary logo preview" class="max-h-full max-w-full object-contain">
                  <Icon v-else name="lucide:gallery-vertical-end" class="size-4" />
                </div>
                <div>
                  <p class="text-xs font-semibold">
                    Acme Inc
                  </p><p class="text-[10px] text-muted-foreground">
                    Enterprise
                  </p>
                </div>
              </div>
            </aside>
            <div class="flex-1 p-4">
              <div class="h-5 w-24 rounded bg-muted" /><div class="mt-4 grid grid-cols-2 gap-2">
                <div class="h-16 rounded border" /><div class="h-16 rounded border" />
              </div>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="guide" class="mt-4">
        <div data-testid="guest-guide-preview" class="overflow-hidden rounded-lg border bg-background text-foreground" :style="guideStyle">
          <div v-if="branding.primaryLogo" class="border-b bg-card p-3">
            <img :src="branding.primaryLogo.dataUrl" alt="Guest Guide logo preview" class="h-8 max-w-40 object-contain">
          </div>
          <div class="bg-primary p-5 text-primary-foreground">
            <p class="text-xs uppercase tracking-wide">
              Guest guide
            </p><p class="mt-1 font-semibold">
              Welcome to Villa Serenity
            </p>
          </div>
          <div class="space-y-3 bg-background p-4">
            <div class="rounded-lg border bg-card p-3">
              <p class="text-sm font-medium">
                Good to know
              </p><p class="mt-1 text-xs text-muted-foreground">
                Check-in is available from 3:00 PM.
              </p>
            </div><button type="button" class="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
              View check-in steps
            </button>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="invoice" class="mt-4">
        <div class="rounded-lg border bg-background p-5 text-foreground font-sans space-y-4">
          <!-- Top Header: Company info (left) & Logo / Invoice Title (right) -->
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-0.5 text-[11px] text-foreground">
              <p class="font-bold text-xs uppercase tracking-tight text-foreground">
                Elev8 Property Group
              </p>
              <p class="text-muted-foreground">
                22a Pantai Berawa
              </p>
              <p class="text-muted-foreground">
                Canggu, Bali 80361
              </p>
              <p class="pt-1 text-muted-foreground">
                Phone: +62 361 908 1234
              </p>
              <p class="text-muted-foreground">
                https://elev8bali.com
              </p>
              <p class="text-muted-foreground">
                NPWP: 01.234.567.8-901.000
              </p>
            </div>

            <div class="text-right">
              <div class="flex justify-end">
                <img
                  v-if="invoiceLogo"
                  data-testid="invoice-preview-logo"
                  :src="invoiceLogo.dataUrl"
                  alt="Invoice logo preview"
                  class="h-10 max-w-40 object-contain"
                >
                <div v-else class="flex items-center gap-1.5 text-base font-bold tracking-tight text-foreground">
                  <div class="flex size-6 items-center justify-center rounded bg-slate-900 text-[10px] font-black text-white dark:bg-slate-100 dark:text-slate-900">
                    E8
                  </div>
                  Elev8
                </div>
              </div>

              <div class="mt-3">
                <p class="text-sm font-bold tracking-tight text-foreground">
                  Tax Invoice / Receipt
                </p>
                <p class="text-[11px] text-muted-foreground">
                  Invoice # 3189
                </p>
              </div>
            </div>
          </div>

          <!-- Date on Left -->
          <div class="text-[11px] text-foreground font-medium pt-1">
            Saturday, 21 February 2026
          </div>

          <!-- Invoiced To -->
          <div class="flex items-start gap-6 text-[11px]">
            <span class="font-bold text-foreground shrink-0">Invoiced To:</span>
            <div class="space-y-0.5">
              <p class="font-bold uppercase tracking-tight text-foreground">
                Bruce Springsteen
              </p>
              <p class="font-bold text-foreground/90">
                Villa Serenity
              </p>
              <p class="font-bold text-foreground/90">
                Canggu, Bali
              </p>
            </div>
          </div>

          <!-- Items Table with Gray Header -->
          <div class="mt-2 overflow-hidden rounded-none border-b border-border">
            <div class="flex items-center justify-between bg-slate-300 px-3 py-1.5 text-xs font-bold text-slate-900 dark:bg-slate-700 dark:text-slate-100">
              <span>Item</span>
              <div class="flex items-center gap-8">
                <span class="w-16 text-right">Tax / Svc</span>
                <span class="w-16 text-right">Cost</span>
              </div>
            </div>

            <div class="divide-y divide-border/60 text-xs">
              <div class="flex items-start justify-between px-3 py-2.5">
                <div class="space-y-0.5">
                  <p class="font-medium text-foreground">
                    Accommodation - 3 nights on 15/09/2026 to 18/09/2026
                  </p>
                  <p class="text-[10px] text-muted-foreground">
                    Villa Serenity (2 guests) · Paid via Airbnb
                  </p>
                </div>
                <div class="flex items-center gap-8 text-right shrink-0 pt-0.5">
                  <span class="w-16 text-muted-foreground">$75.00</span>
                  <span class="w-16 font-medium text-foreground">$750.00</span>
                </div>
              </div>

              <div class="flex items-start justify-between px-3 py-2.5">
                <div class="space-y-0.5">
                  <p class="font-medium text-foreground">
                    Airport Transfer (Toyota Alphard)
                  </p>
                  <p class="text-[10px] text-muted-foreground">
                    1 × $45.00 (Tax 10% · Service 5%)
                  </p>
                </div>
                <div class="flex items-center gap-8 text-right shrink-0">
                  <span class="w-16 text-muted-foreground">$6.75</span>
                  <span class="w-16 font-medium text-foreground">$51.75</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Totals Section (Right-aligned) -->
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
              <span class="w-16 text-right">$801.75</span>
            </div>
          </div>

          <!-- Two-Column Lower Section: Bank Transfer & Payment Method -->
          <div class="grid grid-cols-2 gap-4 pt-3 border-t border-border/70">
            <!-- Left: Bank Transfer Details -->
            <div class="space-y-1 text-[11px]">
              <p class="font-bold text-foreground">
                Bank Transfer Details
              </p>
              <p class="text-muted-foreground">
                Account Name: Elev8 Property Group
              </p>
              <p class="text-muted-foreground">
                Bank: Bank Central Asia (BCA)
              </p>
              <p class="text-muted-foreground">
                Account No: 7890 1234 56
              </p>
              <p class="text-muted-foreground">
                Reference: 3189
              </p>
            </div>

            <!-- Right: Payment Method Header & PAID IN FULL Stamp -->
            <div class="space-y-3">
              <div class="overflow-hidden rounded-none">
                <div class="flex items-center justify-end bg-slate-300 px-3 py-1.5 text-xs font-bold text-slate-900 dark:bg-slate-700 dark:text-slate-100">
                  <span>Payment Method</span>
                </div>
                <div class="flex items-center justify-between px-3 py-1 text-xs">
                  <span class="text-muted-foreground">Airbnb (Prepaid)</span>
                  <span class="font-medium text-foreground">$750.00</span>
                </div>
                <div class="flex items-center justify-between px-3 py-1 text-xs">
                  <span class="text-muted-foreground">Cash</span>
                  <span class="font-medium text-foreground">$51.75</span>
                </div>
              </div>

              <div class="text-right">
                <p class="text-base font-black tracking-tight text-foreground">
                  PAID IN FULL
                </p>
                <p class="text-[11px] text-muted-foreground">
                  on 15/09/2026
                </p>
              </div>
            </div>
          </div>

          <!-- Footer Terms & Contacts -->
          <div class="space-y-0.5 pt-4 text-[10px] text-muted-foreground border-t border-border/40">
            <p>Thank you for choosing Elev8 Property Group.</p>
            <p>W: www.elev8bali.com</p>
            <p>FB: @elev8propertygroup</p>
            <p class="pt-1">
              Terms & Conditions: https://elev8bali.com/terms
            </p>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>
