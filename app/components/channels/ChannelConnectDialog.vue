<script setup lang="ts">
import type { ChannelAccount, ChannelDefinition } from './data/channels'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useChannels } from '~/composables/useChannels'

const props = defineProps<{ channel: ChannelDefinition | null }>()

const emit = defineEmits<{ connected: [account: ChannelAccount] }>()

const open = defineModel<boolean>('open', { default: false })

const { connectAccount, accountsForChannel, isPropertyIdTaken } = useChannels()

const accountName = ref('')
const propertyId = ref('')
const connecting = ref(false)

const existing = computed(() => props.channel ? accountsForChannel(props.channel.name) : [])
const isAdding = computed(() => existing.value.length > 0)

watch(open, (value) => {
  if (value) {
    accountName.value = isAdding.value ? '' : 'Elev8 Bali Villas'
    propertyId.value = ''
    connecting.value = false
  }
})

const needsId = computed(() => props.channel?.method === 'property_id')

// With several accounts on one channel, the name is how staff tell them apart.
const nameError = computed(() => {
  const name = accountName.value.trim().toLowerCase()
  if (!name)
    return isAdding.value ? 'Give this account a name to tell it apart.' : ''
  return existing.value.some(a => a.accountName.toLowerCase() === name) ? 'Another account on this channel already has this name.' : ''
})

const idError = computed(() => props.channel && isPropertyIdTaken(props.channel.name, propertyId.value)
  ? 'This property is already connected.'
  : '')

const canSubmit = computed(() => !connecting.value
  && !nameError.value
  && !idError.value
  && (!needsId.value || propertyId.value.trim() !== ''))

async function submit() {
  const channel = props.channel
  if (!channel || !canSubmit.value)
    return
  connecting.value = true
  const account = await connectAccount(channel.name, { accountName: accountName.value, propertyId: propertyId.value })
  connecting.value = false
  if (!account) {
    toast.error('This property is already connected.')
    return
  }
  open.value = false
  toast.success(`${channel.name} account "${account.accountName}" connected`)
  emit('connected', account)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent v-if="channel" class="sm:max-w-md">
      <DialogHeader>
        <div class="mb-1 flex size-10 items-center justify-center rounded-lg border bg-background">
          <Icon :name="channel.icon" class="size-6" />
        </div>
        <DialogTitle>{{ isAdding ? `Add another ${channel.name} account` : `Connect ${channel.name}` }}</DialogTitle>
        <DialogDescription>
          <template v-if="channel.method === 'oauth'">
            You will sign in to {{ channel.name }} and allow Elev8 to manage your listings, calendar, rates and messages.
          </template>
          <template v-else>
            Enter the property id from your {{ channel.name }} extranet and select Elev8 as your channel manager there.
          </template>
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="flex flex-col gap-1.5">
          <Label for="channel-account-name">Account name</Label>
          <Input id="channel-account-name" v-model="accountName" :placeholder="isAdding ? 'e.g. Canggu owner account' : 'Elev8 Bali Villas'" :aria-invalid="!!nameError" />
          <p v-if="nameError" class="text-xs text-destructive">
            {{ nameError }}
          </p>
          <p v-else class="text-xs text-muted-foreground">
            Only shown inside Elev8, to tell accounts apart.
          </p>
        </div>

        <div v-if="needsId" class="flex flex-col gap-1.5">
          <Label for="channel-account-id">{{ channel.propertyIdLabel }}</Label>
          <Input id="channel-account-id" v-model="propertyId" inputmode="numeric" placeholder="e.g. 10458231" :aria-invalid="!!idError" />
          <p v-if="idError" class="text-xs text-destructive">
            {{ idError }}
          </p>
        </div>

        <div v-else class="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Icon name="lucide:shield-check" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span v-if="isAdding">Sign in with the other {{ channel.name }} login. If you are still signed in to {{ existing[0]?.accountName }} there, sign out first.</span>
          <span v-else>Elev8 never sees your {{ channel.name }} password. You can revoke access from {{ channel.name }} at any time.</span>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="connecting" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="!canSubmit">
            <Icon v-if="connecting" name="lucide:loader-circle" class="mr-1.5 size-4 animate-spin" aria-hidden="true" />
            <template v-if="connecting">
              Connecting...
            </template>
            <template v-else-if="channel.method === 'oauth'">
              Sign in with {{ channel.name }}
            </template>
            <template v-else>
              Connect
            </template>
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
