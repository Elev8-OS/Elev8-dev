<script setup lang="ts">
import type { OnboardingWizardStepId } from '~/components/onboarding/data/onboarding'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'blank' })

const {
  state,
  status,
  step,
  pmsModel,
  integrationPath,
  orderSummary,
  isSavingPayment,
  isConnectingPms,
  isImporting,
  declinePaymentMethod,
  skipBranding,
  hydrate,
  revalidatePromo,
  startImport,
  completeOnboarding,
  resetOnboarding,
} = useOnboarding()

// Resume happens on mount: whatever the tenant finished last decides the screen.
onMounted(hydrate)

/**
 * Local override so the tenant can step backwards through the wizard without
 * rewinding their saved status, which only ever moves forward (PRD 7.1).
 */
const viewStep = ref<typeof step.value | null>(null)
const current = computed(() => viewStep.value ?? step.value)

watch(step, () => { viewStep.value = null })

/**
 * The welcome screen is the only screen with no place in the state machine:
 * acknowledging it changes neither `status` nor `step`. Without a local flag the
 * card just re-renders itself and the button looks dead.
 */
const welcomeDismissed = ref(false)
const showWelcome = computed(() =>
  !welcomeDismissed.value
  && status.value === 'email_verified'
  && !state.value.profile.companyName)

const wizardStep = computed<OnboardingWizardStepId | null>(() => {
  switch (current.value) {
    case 'profile': return 'profile'
    case 'branding': return 'branding'
    case 'select_model':
    case 'select_plan':
    case 'payment': return 'plan'
    default: return null
  }
})

/** Migration gets one more screen before the dashboard. */
const showReconnect = ref(false)

const isFinished = computed(() =>
  !showWelcome.value
  && !wizardStep.value
  && current.value !== 'integration'
  && current.value !== 'import'
  && !showReconnect.value)

const currentDotIndex = computed(() => {
  if (showWelcome.value)
    return 0
  if (showReconnect.value || isFinished.value)
    return 4
  switch (current.value) {
    case 'profile': return 0
    case 'branding': return 1
    case 'select_model':
    case 'select_plan': return 2
    case 'payment': return 3
    case 'integration':
    case 'import': return 4
    default: return 4
  }
})

const heading = computed(() => {
  if (showWelcome.value)
    return 'Welcome to ELEV8'
  if (showReconnect.value)
    return 'Reconnect your channels'
  if (isFinished.value)
    return 'You\'re all set! 🎉'
  switch (current.value) {
    case 'profile': return 'Tell us about yourself'
    case 'branding': return 'Make it yours'
    case 'select_model': return 'Pick your setup'
    case 'select_plan': return 'Pick your plan'
    case 'payment': return 'Payment & billing'
    case 'integration': return integrationPath.value === 'channels' ? 'Connect your channels' : 'Connect your PMS'
    case 'import': return 'Importing your data'
    default: return 'You\'re all set! 🎉'
  }
})

const subheading = computed(() => {
  if (showWelcome.value)
    return 'Your email is verified. Three short steps and your dashboard is ready.'
  if (showReconnect.value)
    return 'Channels do not move across on their own. Reconnect each channel to keep rates and availability in sync.'
  if (isFinished.value)
    return 'Your workspace is ready. Start exploring and get things done.'
  switch (current.value) {
    case 'profile': return 'A few quick questions to personalize your experience.'
    case 'branding': return 'Customize how your brand appears in the dashboard, Guest Guide, and invoices.'
    case 'select_model': return 'Choose whether to run full ELEV8, connect your existing PMS, or migrate from another platform.'
    case 'select_plan': return 'Pick the pricing model and tier that fits your property portfolio.'
    case 'payment': return 'Enter your payment details to activate your subscription.'
    case 'integration': return integrationPath.value === 'channels' ? 'Sync your properties directly with Airbnb, Booking.com, and VRBO.' : 'Connect your PMS to import properties, reservations, and guests.'
    case 'import': return 'Please wait while we sync your properties, reservations, and guests.'
    default: return 'Your workspace is ready. Start exploring and get things done.'
  }
})

const canGoBack = computed(() => {
  if (showWelcome.value)
    return false
  if (current.value === 'branding')
    return true
  if (current.value === 'select_model')
    return true
  if (current.value === 'select_plan')
    return true
  if (current.value === 'payment')
    return true
  if (isFinished.value)
    return true
  return false
})

function handleBack(): void {
  if (current.value === 'branding')
    go('profile')
  else if (current.value === 'select_model')
    go('branding')
  else if (current.value === 'select_plan')
    go('select_model')
  else if (current.value === 'payment')
    go('select_plan')
  else if (isFinished.value)
    restart()
}

function go(next: typeof step.value): void {
  viewStep.value = next
}

function onModelChosen(): void {
  go('select_plan')
}

async function onPlanChosen(): Promise<void> {
  // A plan change can strand an applied code, so it is rechecked here (PRD 8).
  const result = await revalidatePromo()
  if (result && !result.valid)
    toast.warning(`${result.message}`)
  go('payment')
}

function onPaid(): void {
  if (integrationPath.value === 'channels') {
    go('integration')
    return
  }
  go('integration')
}

function onPmsConnected(): void {
  startImport()
  go('import')
}

function onImportDone(): void {
  if (pmsModel.value === 'MIGRATION') {
    showReconnect.value = true
    return
  }
  finish()
}

function finish(): void {
  completeOnboarding()
  toast.success('Welcome to ELEV8.')
  navigateTo('/')
}

function onVerifiedContinue(): void {
  welcomeDismissed.value = true
  go('profile')
}

function skipBrandingAndGo(): void {
  skipBranding()
  go('select_model')
}

function onDeclineCard(): void {
  declinePaymentMethod()
  toast.info('Your plan stays inactive until you save a card.')
  onPaid()
}

function restart(): void {
  resetOnboarding()
  welcomeDismissed.value = false
  viewStep.value = null
  showReconnect.value = false
  toast.success('Onboarding has been reset.')
}

function handleLogout(): void {
  toast.info('You have been logged out.')
  navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col lg:flex-row">
    <!-- Left Column (matches reference Image 1 & Image 2) -->
    <aside class="w-full lg:w-[380px] xl:w-[440px] shrink-0 bg-muted/20 border-b lg:border-b-0 lg:border-r border-border/70 flex flex-col justify-between p-6 sm:p-8 lg:p-12">
      <div class="flex flex-col">
        <!-- Top navigation: Back button & Logout button -->
        <div class="h-9 mb-4 flex items-center justify-between">
          <Button
            v-if="canGoBack"
            variant="ghost"
            size="sm"
            class="-ml-2.5 inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors cursor-pointer"
            @click="handleBack"
          >
            <Icon name="lucide:chevron-left" class="size-4" />
            Back
          </Button>
          <div v-else class="h-8" />

          <Button
            variant="ghost"
            size="sm"
            class="-mr-2.5 inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            data-testid="onboarding-logout-button"
            @click="handleLogout"
          >
            <Icon name="lucide:log-out" class="size-4" />
            <span>Log out</span>
          </Button>
        </div>

        <!-- Heading & Subheading -->
        <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          {{ heading }}
        </h1>
        <p class="text-muted-foreground text-sm sm:text-base mt-3 leading-relaxed">
          {{ subheading }}
        </p>
      </div>

      <!-- Bottom action and stepper -->
      <div class="mt-8 pt-6 flex flex-col gap-6">
        <!-- 1. Welcome action -->
        <Button
          v-if="showWelcome"
          size="lg"
          class="w-full h-12 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
          @click="onVerifiedContinue"
        >
          Setup my profile
          <Icon name="lucide:arrow-right" class="ml-2 size-4" />
        </Button>

        <!-- 2. Profile step -->
        <Button
          v-else-if="current === 'profile'"
          type="submit"
          form="ob-profile-form"
          size="lg"
          class="w-full h-12 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
        >
          Next
        </Button>

        <!-- 3. Branding step -->
        <div v-else-if="current === 'branding'" class="flex flex-col gap-2">
          <Button
            type="submit"
            form="ob-branding-form"
            size="lg"
            class="w-full h-12 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
          >
            Next
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            @click="skipBrandingAndGo"
          >
            Skip for now
          </Button>
        </div>

        <!-- 4. Select Model step -->
        <Button
          v-else-if="current === 'select_model'"
          type="submit"
          form="ob-model-form"
          size="lg"
          class="w-full h-12 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
        >
          Next
        </Button>

        <!-- 5. Select Plan step -->
        <Button
          v-else-if="current === 'select_plan'"
          type="submit"
          form="ob-plan-form"
          size="lg"
          class="w-full h-12 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
        >
          Next
        </Button>

        <!-- 6. Payment step -->
        <div v-else-if="current === 'payment'" class="flex flex-col gap-2">
          <Button
            type="submit"
            form="ob-payment-form"
            size="lg"
            :disabled="isSavingPayment"
            class="w-full h-12 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
          >
            <Icon v-if="isSavingPayment" name="lucide:loader-2" class="mr-2 size-4 animate-spin" />
            Next
          </Button>
          <Button
            v-if="orderSummary?.total === 0"
            variant="ghost"
            size="sm"
            :disabled="isSavingPayment"
            class="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            @click="onDeclineCard"
          >
            Continue without saving a card
          </Button>
        </div>

        <!-- 7. Integration: Channels -->
        <div v-else-if="current === 'integration' && integrationPath === 'channels'" class="flex flex-col gap-2">
          <Button
            size="lg"
            class="w-full h-12 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
            @click="finish"
          >
            Go to dashboard
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            @click="finish"
          >
            I will do this later
          </Button>
        </div>

        <!-- 8. Integration: PMS -->
        <Button
          v-else-if="current === 'integration' && integrationPath === 'pms'"
          type="submit"
          form="ob-connect-pms-form"
          size="lg"
          :disabled="isConnectingPms"
          class="w-full h-12 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
        >
          <Icon v-if="isConnectingPms" name="lucide:loader-2" class="mr-2 size-4 animate-spin" />
          Sign in and import
        </Button>

        <!-- 9. Import Progress -->
        <div v-else-if="current === 'import' && !showReconnect" class="flex flex-col gap-2">
          <Button
            size="lg"
            :disabled="isImporting"
            class="w-full h-12 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
            @click="onImportDone"
          >
            Continue
          </Button>
          <Button
            v-if="isImporting"
            variant="ghost"
            size="sm"
            class="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            @click="finish"
          >
            Continue in background
          </Button>
        </div>

        <!-- 10. Reconnect Channels -->
        <div v-else-if="showReconnect" class="flex flex-col gap-2">
          <Button
            size="lg"
            class="w-full h-12 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
            @click="finish"
          >
            Go to dashboard
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            @click="finish"
          >
            I will do this later
          </Button>
        </div>

        <!-- 11. Completed action (Image 2) -->
        <div v-else-if="isFinished" class="flex flex-col gap-2">
          <Button
            type="button"
            size="lg"
            class="w-full h-12 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
            @click="navigateTo('/')"
          >
            Go to Dashboard
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            @click="restart"
          >
            Reset onboarding
          </Button>
        </div>

        <!-- 5-Dot Stepper (Matches Reference Image 1 & 2) -->
        <div class="flex items-center">
          <OnboardingStepper :current="wizardStep" :step-index="currentDotIndex" />
        </div>
      </div>
    </aside>

    <!-- Right Column (Content area) -->
    <main class="flex-1 flex flex-col justify-center overflow-y-auto p-6 sm:p-10 lg:p-12">
      <!-- 1. Welcome Screen -->
      <div v-if="showWelcome" data-testid="onboarding-welcome" class="mx-auto w-full max-w-xl">
        <Card class="rounded-2xl border-border/80 shadow-xs">
          <CardHeader>
            <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
              <Icon name="lucide:mail-check" class="size-6" />
            </div>
            <CardTitle class="text-xl">
              Your email is verified
            </CardTitle>
            <CardDescription class="text-sm">
              Three short steps and your dashboard is ready. You can leave at any point and pick up where you stopped.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid gap-3 text-sm">
              <div class="flex items-start gap-3 rounded-lg border border-border/60 p-3 bg-muted/20">
                <Icon name="lucide:building-2" class="size-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p class="font-medium text-foreground">
                    Company & host profile
                  </p>
                  <p class="text-xs text-muted-foreground">
                    Legal details for invoices and system operations
                  </p>
                </div>
              </div>
              <div class="flex items-start gap-3 rounded-lg border border-border/60 p-3 bg-muted/20">
                <Icon name="lucide:palette" class="size-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p class="font-medium text-foreground">
                    Brand assets & colors
                  </p>
                  <p class="text-xs text-muted-foreground">
                    Logo and colors shown to your guests
                  </p>
                </div>
              </div>
              <div class="flex items-start gap-3 rounded-lg border border-border/60 p-3 bg-muted/20">
                <Icon name="lucide:layers" class="size-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p class="font-medium text-foreground">
                    Setup & billing plan
                  </p>
                  <p class="text-xs text-muted-foreground">
                    Choose how ELEV8 integrates with your properties
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- 2. Wizard steps -->
      <div v-else-if="wizardStep" class="mx-auto w-full max-w-4xl">
        <OnboardingStepProfile v-if="current === 'profile'" @next="go('branding')" />
        <OnboardingStepBranding
          v-else-if="current === 'branding'"
          @next="go('select_model')"
          @back="go('profile')"
        />
        <OnboardingStepSelectModel
          v-else-if="current === 'select_model'"
          @next="onModelChosen"
          @back="go('branding')"
        />
        <OnboardingStepSelectPlan
          v-else-if="current === 'select_plan'"
          @next="onPlanChosen"
          @back="go('select_model')"
        />
        <OnboardingStepPayment
          v-else
          @next="onPaid"
          @back="go('select_plan')"
        />
      </div>

      <!-- 3. Integrations -->
      <div v-else-if="current === 'integration' && !showReconnect" class="mx-auto w-full max-w-4xl">
        <OnboardingConnectChannels
          v-if="integrationPath === 'channels'"
          @done="finish"
        />
        <OnboardingConnectPms v-else @connected="onPmsConnected" />
      </div>

      <!-- 4. Import progress -->
      <div v-else-if="current === 'import' && !showReconnect" class="mx-auto w-full max-w-2xl">
        <OnboardingImportProgress @background="finish" @done="onImportDone" />
      </div>

      <!-- 5. Reconnect channels -->
      <div v-else-if="showReconnect" class="mx-auto w-full max-w-4xl">
        <OnboardingReconnectChannels @done="finish" />
      </div>

      <!-- 6. Completed Screen: Rich Dashboard Preview (Matching Reference Image 2) -->
      <div v-else class="mx-auto w-full max-w-5xl flex flex-col items-center">
        <!-- Mock Dashboard Container matching Image 2 -->
        <div class="w-full rounded-2xl border border-border/80 bg-background shadow-lg overflow-hidden text-foreground">
          <!-- Top Bar with navigation tabs and search -->
          <div class="border-b border-border/60 bg-muted/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <!-- Navigation Tabs -->
            <div class="flex items-center gap-1">
              <span class="px-3 py-1 text-xs font-semibold rounded-md bg-background shadow-xs text-foreground">Dashboard</span>
              <span class="px-3 py-1 text-xs text-muted-foreground hover:text-foreground">Blocks</span>
              <span class="px-3 py-1 text-xs text-muted-foreground hover:text-foreground">Mail</span>
              <span class="px-3 py-1 text-xs text-muted-foreground hover:text-foreground">Component</span>
            </div>

            <!-- Search and user actions -->
            <div class="flex items-center gap-2">
              <div class="relative w-44 sm:w-56">
                <Icon name="lucide:search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Type to search..."
                  disabled
                  class="w-full h-7 pl-8 pr-2 text-xs rounded-md border border-border/70 bg-background text-muted-foreground"
                >
              </div>
              <div class="flex items-center gap-1.5 text-muted-foreground">
                <Icon name="lucide:languages" class="size-4 opacity-70" />
                <Icon name="lucide:sparkles" class="size-4 text-amber-500 opacity-90" />
                <Icon name="lucide:bell" class="size-4 opacity-70" />
                <div class="size-6 rounded-full bg-foreground text-background flex items-center justify-center text-[10px] font-bold">
                  E
                </div>
              </div>
            </div>
          </div>

          <div class="p-4 sm:p-6 space-y-4 bg-background">
            <!-- Row 1: Metric stat cards (Matching Image 2) -->
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <!-- Total Sales -->
              <div class="rounded-xl border border-border/60 p-3 bg-card shadow-2xs">
                <div class="flex items-center justify-between">
                  <div class="size-7 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center">
                    <Icon name="lucide:ticket" class="size-4" />
                  </div>
                  <span class="text-[11px] font-medium text-emerald-600 flex items-center">+38% <Icon name="lucide:chevron-up" class="size-3" /></span>
                </div>
                <p class="mt-2 text-base font-bold">
                  $13.4k
                </p>
                <p class="text-[11px] text-muted-foreground">
                  Total Sales
                </p>
                <span class="mt-2 inline-block px-1.5 py-0.5 text-[9px] rounded bg-muted text-muted-foreground">Last 6 months</span>
              </div>

              <!-- Total Orders -->
              <div class="rounded-xl border border-border/60 p-3 bg-card shadow-2xs">
                <div class="flex items-center justify-between">
                  <div class="size-7 rounded-lg bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                    <Icon name="lucide:shopping-cart" class="size-4" />
                  </div>
                  <span class="text-[11px] font-medium text-emerald-600 flex items-center">+22% <Icon name="lucide:chevron-up" class="size-3" /></span>
                </div>
                <p class="mt-2 text-base font-bold">
                  155K
                </p>
                <p class="text-[11px] text-muted-foreground">
                  Total Orders
                </p>
                <span class="mt-2 inline-block px-1.5 py-0.5 text-[9px] rounded bg-muted text-muted-foreground">Last 4 months</span>
              </div>

              <!-- Total Profit -->
              <div class="rounded-xl border border-border/60 p-3 bg-card shadow-2xs">
                <div class="flex items-center justify-between">
                  <div class="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <Icon name="lucide:dollar-sign" class="size-4" />
                  </div>
                  <span class="text-[11px] font-medium text-red-500 flex items-center">-16% <Icon name="lucide:chevron-down" class="size-3" /></span>
                </div>
                <p class="mt-2 text-base font-bold">
                  $89.34k
                </p>
                <p class="text-[11px] text-muted-foreground">
                  Total Profit
                </p>
                <span class="mt-2 inline-block px-1.5 py-0.5 text-[9px] rounded bg-muted text-muted-foreground">Last One year</span>
              </div>

              <!-- Bookmarks -->
              <div class="rounded-xl border border-border/60 p-3 bg-card shadow-2xs">
                <div class="flex items-center justify-between">
                  <div class="size-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <Icon name="lucide:bookmark" class="size-4" />
                  </div>
                  <span class="text-[11px] font-medium text-emerald-600 flex items-center">+38% <Icon name="lucide:chevron-up" class="size-3" /></span>
                </div>
                <p class="mt-2 text-base font-bold">
                  $1,200
                </p>
                <p class="text-[11px] text-muted-foreground">
                  Bookmarks
                </p>
                <span class="mt-2 inline-block px-1.5 py-0.5 text-[9px] rounded bg-muted text-muted-foreground">Last 6 months</span>
              </div>

              <!-- Customers -->
              <div class="rounded-xl border border-border/60 p-3 bg-card shadow-2xs flex items-center justify-between col-span-2 sm:col-span-1">
                <div>
                  <p class="text-xs font-semibold">
                    Customers
                  </p>
                  <span class="px-1.5 py-0.5 text-[9px] rounded bg-muted text-muted-foreground">Daily customers</span>
                  <p class="mt-1 text-base font-bold">
                    42.4k <span class="text-xs font-normal text-emerald-600">+9.2%</span>
                  </p>
                </div>
                <div class="size-10 rounded-full bg-muted/60 flex items-center justify-center text-foreground">
                  <Icon name="lucide:smile" class="size-6 text-foreground/80" />
                </div>
              </div>
            </div>

            <!-- Row 2: Charts and Reports (Matching Image 2) -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <!-- Total income Area Chart (5 cols) -->
              <div class="lg:col-span-5 rounded-xl border border-border/60 p-4 bg-card shadow-2xs flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between">
                    <p class="text-xs font-semibold">
                      Total income
                    </p>
                    <Icon name="lucide:more-vertical" class="size-3.5 text-muted-foreground" />
                  </div>
                  <p class="text-[10px] text-muted-foreground">
                    Weekly report overview
                  </p>
                </div>

                <!-- SVG Area Chart Graphic -->
                <div class="my-3 h-28 w-full flex items-end">
                  <svg class="w-full h-full" viewBox="0 0 240 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="income-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#10B981" stop-opacity="0.35" />
                        <stop offset="100%" stop-color="#10B981" stop-opacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 0,75 Q 40,70 80,45 T 160,50 T 240,15 L 240,100 L 0,100 Z"
                      fill="url(#income-grad)"
                    />
                    <path
                      d="M 0,75 Q 40,70 80,45 T 160,50 T 240,15"
                      fill="none"
                      stroke="#10B981"
                      stroke-width="2.5"
                    />
                  </svg>
                </div>

                <div class="flex justify-between text-[9px] text-muted-foreground border-t border-border/40 pt-1">
                  <span>MO</span><span>TU</span><span>WE</span><span>TH</span><span>FR</span><span>SA</span><span>SU</span>
                </div>
              </div>

              <!-- Report Activity (3 cols) -->
              <div class="lg:col-span-3 rounded-xl border border-border/60 p-4 bg-card shadow-2xs space-y-3">
                <div class="flex items-center justify-between">
                  <p class="text-xs font-semibold">
                    Report
                  </p>
                  <Icon name="lucide:more-vertical" class="size-3.5 text-muted-foreground" />
                </div>
                <p class="text-[10px] text-muted-foreground">
                  Weekly activity
                </p>

                <div class="space-y-2 pt-1 text-xs">
                  <div class="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <span class="flex items-center gap-1.5 text-muted-foreground"><Icon name="lucide:wallet" class="size-3.5 text-emerald-600" /> Income</span>
                    <span class="font-semibold">$5,550</span>
                  </div>
                  <div class="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <span class="flex items-center gap-1.5 text-muted-foreground"><Icon name="lucide:receipt" class="size-3.5 text-orange-600" /> Expense</span>
                    <span class="font-semibold">$3,520</span>
                  </div>
                  <div class="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <span class="flex items-center gap-1.5 text-muted-foreground"><Icon name="lucide:badge-dollar-sign" class="size-3.5 text-yellow-600" /> Profit</span>
                    <span class="font-semibold">$2,350</span>
                  </div>
                </div>
              </div>

              <!-- Monthly campaign state (4 cols) -->
              <div class="lg:col-span-4 rounded-xl border border-border/60 p-4 bg-card shadow-2xs space-y-2">
                <div class="flex items-center justify-between">
                  <p class="text-xs font-semibold">
                    Monthly campaign state
                  </p>
                  <Icon name="lucide:more-vertical" class="size-3.5 text-muted-foreground" />
                </div>
                <p class="text-[10px] text-muted-foreground">
                  7.58k Social Visitors
                </p>

                <div class="space-y-1.5 pt-1 text-xs">
                  <div class="flex items-center justify-between">
                    <span class="flex items-center gap-1 text-muted-foreground"><Icon name="lucide:mail" class="size-3 text-red-500" /> Emails</span>
                    <span class="font-medium">14,250 <span class="text-[10px] text-muted-foreground">0.3%</span></span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="flex items-center gap-1 text-muted-foreground"><Icon name="lucide:mail-open" class="size-3 text-emerald-500" /> Opened</span>
                    <span class="font-medium">4,523 <span class="text-[10px] text-muted-foreground">3.1%</span></span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="flex items-center gap-1 text-muted-foreground"><Icon name="lucide:mouse-pointer-click" class="size-3 text-amber-500" /> Clicked</span>
                    <span class="font-medium">1,250 <span class="text-[10px] text-muted-foreground">1.3%</span></span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="flex items-center gap-1 text-muted-foreground"><Icon name="lucide:bell" class="size-3 text-sky-500" /> Subscribed</span>
                    <span class="font-medium">750 <span class="text-[10px] text-muted-foreground">9.8%</span></span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="flex items-center gap-1 text-muted-foreground"><Icon name="lucide:triangle-alert" class="size-3 text-amber-600" /> Errors</span>
                    <span class="font-medium">20 <span class="text-[10px] text-muted-foreground">1.5%</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Hint Caption matching Image 2 -->
        <p class="mt-5 text-sm text-center text-muted-foreground">
          Hit <strong class="font-semibold text-foreground">Go to Dashboard</strong> on the left to start exploring.
        </p>

        <!-- Status confirmation for tests -->
        <p class="mt-1 text-xs text-muted-foreground/60 text-center">
          Onboarding is complete
        </p>
      </div>
    </main>
  </div>
</template>
