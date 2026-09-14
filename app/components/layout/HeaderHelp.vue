<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const showSupportModal = ref(false)
const showDocsModal = ref(false)

// Support form state
const supportSubject = ref('')
const supportMessage = ref('')
const supportSending = ref(false)

function submitSupport() {
  if (!supportSubject.value.trim() || !supportMessage.value.trim()) {
    toast.error('Please enter a subject and message.')
    return
  }
  supportSending.value = true
  setTimeout(() => {
    supportSending.value = false
    toast.success('Support request sent! Our team will respond shortly.')
    supportSubject.value = ''
    supportMessage.value = ''
    showSupportModal.value = false
  }, 400)
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="size-8 text-muted-foreground hover:text-foreground"
        aria-label="Help & Resources"
        data-testid="header-help-trigger"
      >
        <Icon name="i-lucide-circle-help" class="size-5" />
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent class="w-56" align="end" :side-offset="8">
      <DropdownMenuLabel class="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Help & Resources
      </DropdownMenuLabel>
      <DropdownMenuGroup>
        <DropdownMenuItem class="cursor-pointer" @click="showDocsModal = true">
          <Icon name="i-lucide-book-open" class="mr-2 size-4 text-muted-foreground" />
          <span>Documentation</span>
        </DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      <DropdownMenuGroup>
        <DropdownMenuItem class="cursor-pointer" @click="showSupportModal = true">
          <Icon name="i-lucide-headset" class="mr-2 size-4 text-muted-foreground" />
          <span>Contact support</span>
        </DropdownMenuItem>
        <DropdownMenuItem as-child class="cursor-pointer">
          <NuxtLink to="/changelog">
            <Icon name="i-lucide-history" class="mr-2 size-4 text-muted-foreground" />
            <span>Changelog</span>
          </NuxtLink>
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>

  <!-- Documentation Dialog -->
  <Dialog v-model:open="showDocsModal">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon name="i-lucide-book-open" class="size-5 text-primary" />
          Documentation & Quick Guides
        </DialogTitle>
        <DialogDescription class="text-xs text-muted-foreground">
          Explore comprehensive guides to get the most out of Elev8 OS.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 py-2">
        <div class="grid gap-2 sm:grid-cols-2">
          <NuxtLink
            to="/listings"
            class="group flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
            @click="showDocsModal = false"
          >
            <div class="flex items-center gap-2 font-medium text-sm">
              <Icon name="i-lucide-home" class="size-4 text-primary" />
              <span>Listings & Units</span>
            </div>
            <p class="text-xs text-muted-foreground">
              Manage multi-unit types, OTA sync, and unit details.
            </p>
          </NuxtLink>

          <NuxtLink
            to="/inbox"
            class="group flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
            @click="showDocsModal = false"
          >
            <div class="flex items-center gap-2 font-medium text-sm">
              <Icon name="i-lucide-messages-square" class="size-4 text-primary" />
              <span>Guest Messaging</span>
            </div>
            <p class="text-xs text-muted-foreground">
              Unified 4-panel inbox with WhatsApp, OTA channels & ElevAI.
            </p>
          </NuxtLink>

          <NuxtLink
            to="/operations-calendar"
            class="group flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
            @click="showDocsModal = false"
          >
            <div class="flex items-center gap-2 font-medium text-sm">
              <Icon name="i-lucide-calendar-days" class="size-4 text-primary" />
              <span>Operations Calendar</span>
            </div>
            <p class="text-xs text-muted-foreground">
              Staff shifts, cleaning schedules, and maintenance tasks.
            </p>
          </NuxtLink>

          <NuxtLink
            to="/key-management"
            class="group flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
            @click="showDocsModal = false"
          >
            <div class="flex items-center gap-2 font-medium text-sm">
              <Icon name="i-lucide-key-round" class="size-4 text-primary" />
              <span>Key Management</span>
            </div>
            <p class="text-xs text-muted-foreground">
              Physical key tracking, custody transfers & digital key boxes.
            </p>
          </NuxtLink>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" @click="showDocsModal = false">
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Contact Support Dialog -->
  <Dialog v-model:open="showSupportModal">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon name="i-lucide-headset" class="size-5 text-primary" />
          Contact Support
        </DialogTitle>
        <DialogDescription class="text-xs text-muted-foreground">
          Our Bali operations team and support engineers are here to assist you 24/7.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-2">
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="rounded-lg border bg-muted/20 p-2.5">
            <div class="flex items-center gap-1.5 font-medium text-foreground">
              <Icon name="i-lucide-mail" class="size-3.5 text-primary" />
              <span>Email Support</span>
            </div>
            <p class="mt-1 text-muted-foreground">
              support@elev8.co
            </p>
          </div>
          <div class="rounded-lg border bg-muted/20 p-2.5">
            <div class="flex items-center gap-1.5 font-medium text-foreground">
              <Icon name="i-lucide-phone" class="size-3.5 text-emerald-600" />
              <span>WhatsApp Hotline</span>
            </div>
            <p class="mt-1 text-muted-foreground">
              +62 812 3456 7890
            </p>
          </div>
        </div>

        <div class="space-y-3">
          <div class="space-y-1.5">
            <Label for="support-subject" class="text-xs font-medium">Subject</Label>
            <Input
              id="support-subject"
              v-model="supportSubject"
              placeholder="e.g., Question about OTA calendar sync"
              class="h-8 text-sm"
            />
          </div>

          <div class="space-y-1.5">
            <Label for="support-message" class="text-xs font-medium">Message</Label>
            <Textarea
              id="support-message"
              v-model="supportMessage"
              placeholder="Describe your issue or question in detail..."
              rows="3"
              class="text-sm"
            />
          </div>
        </div>
      </div>

      <DialogFooter class="sm:justify-between">
        <Button variant="ghost" size="sm" @click="showSupportModal = false">
          Cancel
        </Button>
        <Button size="sm" :disabled="supportSending" @click="submitSupport">
          <Icon v-if="supportSending" name="i-lucide-loader-2" class="mr-1.5 size-4 animate-spin" />
          <Icon v-else name="i-lucide-send" class="mr-1.5 size-4" />
          Send Request
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
