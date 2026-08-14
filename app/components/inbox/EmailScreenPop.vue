<script setup lang="ts">
import { computed } from 'vue'

const email = useEmailIntegration()
const inbox = useInbox()

const activePop = computed(() => email.getActiveEmailPop())

function open() {
  if (!activePop.value)
    return
  inbox.selectedConversationId.value = activePop.value.conversationId
  email.dismissEmailPop(activePop.value.id)
  navigateTo('/inbox')
}

function dismiss() {
  if (!activePop.value)
    return
  email.dismissEmailPop(activePop.value.id)
}
</script>

<template>
  <div v-if="activePop" class="pointer-events-none fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)]">
    <div class="pointer-events-auto rounded-xl border-2 border-sky-500 bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4">
      <div class="flex items-center gap-2 bg-sky-500 text-white px-3 py-2">
        <div class="relative">
          <Icon name="lucide:mail-open" class="size-4 animate-pulse" />
        </div>
        <span class="text-xs font-semibold">Incoming email</span>
        <button
          class="ml-auto rounded p-0.5 hover:bg-white/20 transition-colors"
          aria-label="Dismiss"
          @click="dismiss"
        >
          <Icon name="lucide:x" class="size-3.5" />
        </button>
      </div>
      <div class="p-3 space-y-2">
        <div class="flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 font-semibold">
            {{ activePop.guestName.split(' ').map(n => n[0]).join('').slice(0, 2) }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold truncate">
              {{ activePop.guestName }}
            </p>
            <p class="text-xs text-muted-foreground truncate">
              {{ activePop.listingName }}
            </p>
          </div>
        </div>
        <div v-if="activePop.subject" class="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon name="lucide:mail" class="size-3" />
          <span class="truncate">{{ activePop.subject }}</span>
        </div>
        <div class="flex items-center gap-2 pt-1">
          <Button size="sm" class="flex-1 gap-1.5" @click="open">
            <Icon name="lucide:message-circle" class="size-3.5" />
            Open conversation
          </Button>
          <Button size="sm" variant="outline" @click="dismiss">
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
