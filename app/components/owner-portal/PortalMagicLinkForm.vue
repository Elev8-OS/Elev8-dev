<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useOwnerAuth } from '~/composables/useOwnerAuth'

const email = ref('')
const isSending = ref(false)
const isSent = ref(false)
const secureLinkError = ref('')
const { requestMagicLink, acceptDemoLink } = useOwnerAuth()

async function handleSubmit() {
  if (isSending.value || !email.value.trim())
    return

  isSending.value = true
  secureLinkError.value = ''
  try {
    await requestMagicLink(email.value)
    isSent.value = true
  }
  finally {
    isSending.value = false
  }
}

async function openDemoSecureLink() {
  secureLinkError.value = ''
  const result = acceptDemoLink()
  if (!result.ok) {
    secureLinkError.value = 'This secure link could not be opened. Request a new link and try again.'
    return
  }

  await navigateTo('/owner-portal')
}
</script>

<template>
  <div class="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
    <div v-if="!isSent" class="space-y-6">
      <div class="space-y-2 text-center">
        <h1 class="text-2xl font-semibold tracking-tight">
          Owner Portal
        </h1>
        <p class="text-sm text-muted-foreground">
          Enter your email and we’ll send you a secure sign-in link.
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <label for="owner-email" class="text-sm font-medium">Email address</label>
          <Input
            id="owner-email"
            v-model="email"
            type="email"
            name="email"
            autocomplete="email"
            placeholder="owner@example.com"
            required
            :disabled="isSending"
          />
        </div>
        <Button type="submit" class="w-full" :disabled="isSending || !email.trim()">
          <Icon v-if="isSending" name="lucide:loader-2" class="size-4 animate-spin" aria-hidden="true" />
          {{ isSending ? 'Sending secure link…' : 'Send secure link' }}
        </Button>
      </form>

      <p class="text-center text-xs text-muted-foreground">
        For portal access help, contact your property manager.
      </p>
    </div>

    <div v-else data-testid="magic-link-sent" class="space-y-6 text-center">
      <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon name="lucide:mail-check" class="size-6" aria-hidden="true" />
      </div>
      <div class="space-y-2">
        <h1 class="text-2xl font-semibold tracking-tight">
          Check your email
        </h1>
        <p class="text-sm text-muted-foreground">
          If an owner account matches that email, a secure sign-in link is on its way.
        </p>
      </div>

      <Button
        type="button"
        class="w-full"
        data-testid="open-demo-secure-link"
        @click="openDemoSecureLink"
      >
        <Icon name="lucide:external-link" class="size-4" aria-hidden="true" />
        Open demo secure link
      </Button>

      <p v-if="secureLinkError" role="alert" class="text-sm text-destructive">
        {{ secureLinkError }}
      </p>

      <p class="text-xs text-muted-foreground">
        Demo only: production links would arrive by email and expire automatically.
      </p>
    </div>
  </div>
</template>
