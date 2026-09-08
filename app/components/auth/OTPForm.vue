<script lang="ts" setup>
import { Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { MOCK_OTP_CODE } from '~/composables/useAuthSignup'

const { pendingSignup, completeSignup, verifyCode } = useAuthSignup()
const { markEmailVerified } = useOnboarding()

const RESEND_COOLDOWN_SECONDS = 30

const code = ref<string[]>([])
const isVerifying = ref(false)
const errorMessage = ref('')
const resendIn = ref(0)

let resendTimer: ReturnType<typeof setInterval> | undefined

const targetEmail = computed(() => pendingSignup.value?.email ?? 'your email')
const isComplete = computed(() => code.value.filter(Boolean).length === 6)

async function verify(entered: string[] = code.value) {
  if (entered.filter(Boolean).length !== 6 || isVerifying.value)
    return

  isVerifying.value = true
  errorMessage.value = ''

  // Mock verification, no auth backend yet.
  await new Promise(resolve => setTimeout(resolve, 900))
  isVerifying.value = false

  if (!verifyCode(entered.join(''))) {
    errorMessage.value = 'That code is not valid. Please try again.'
    code.value = []
    return
  }

  completeSignup()
  markEmailVerified()
  toast.success('Email verified.')
  navigateTo('/onboarding')
}

function onSubmit(event: Event) {
  event.preventDefault()
  verify()
}

function stopResendTimer() {
  if (resendTimer) {
    clearInterval(resendTimer)
    resendTimer = undefined
  }
}

function onResend() {
  if (resendIn.value > 0)
    return

  code.value = []
  errorMessage.value = ''
  toast.info(`We sent a new code to ${targetEmail.value}`)

  resendIn.value = RESEND_COOLDOWN_SECONDS
  stopResendTimer()
  resendTimer = setInterval(() => {
    resendIn.value -= 1
    if (resendIn.value <= 0)
      stopResendTimer()
  }, 1000)
}

onBeforeUnmount(stopResendTimer)
</script>

<template>
  <div class="flex flex-col gap-6">
    <form @submit="onSubmit">
      <FieldGroup>
        <div class="flex flex-col items-center gap-1 text-center">
          <h1 class="text-2xl font-bold">
            Enter verification code
          </h1>
          <p class="text-muted-foreground text-sm text-balance">
            We sent a 6-digit code to <span class="font-medium text-foreground">{{ targetEmail }}</span>.
          </p>
        </div>
        <Field>
          <FieldLabel html-for="otp" class="sr-only">
            Verification code
          </FieldLabel>
          <PinInput
            id="otp"
            v-model="code"
            class="justify-center"
            :disabled="isVerifying"
            @complete="verify"
          >
            <PinInputGroup class="gap-1 *:data-[slot=pin-input-slot]:rounded-md *:data-[slot=pin-input-slot]:border">
              <template v-for="(id, index) in 6" :key="id">
                <PinInputSlot :index="index" />
                <template v-if="index !== 5">
                  <PinInputSeparator />
                </template>
              </template>
            </PinInputGroup>
          </PinInput>
          <FieldDescription v-if="errorMessage" class="text-center text-destructive">
            {{ errorMessage }}
          </FieldDescription>
          <FieldDescription v-else class="text-center">
            Demo code: <span class="font-mono">{{ MOCK_OTP_CODE }}</span>
          </FieldDescription>
        </Field>
        <Button type="submit" :disabled="!isComplete || isVerifying">
          <Loader2 v-if="isVerifying" class="mr-2 h-4 w-4 animate-spin" />
          Verify
        </Button>
        <FieldDescription class="text-center">
          Didn&apos;t receive the code?
          <button
            type="button"
            class="underline underline-offset-4 hover:text-primary disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
            :disabled="resendIn > 0"
            @click="onResend"
          >
            {{ resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend' }}
          </button>
        </FieldDescription>
      </FieldGroup>
    </form>
  </div>
</template>

<style>

</style>
