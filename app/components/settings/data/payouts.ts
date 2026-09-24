import { ref } from 'vue'
import { listings } from '~/components/listings/data/listings'

export type PayoutProvider = 'stripe' | 'doku' | 'xendit'
export type PayoutAccountStatus = 'connected' | 'needs_setup' | 'needs_webhook' | 'error'

export interface PayoutField {
  key: string
  label: string
  placeholder: string
  helper: string
  secret?: boolean
}

export interface PayoutProviderConfig {
  id: PayoutProvider
  name: string
  icon: string
  description: string
  connectCopy: string
  fields: PayoutField[]
  steps: string[]
  webhookHint?: string
}

export interface PayoutAccount {
  id: string
  provider: PayoutProvider
  accountName: string
  status: PayoutAccountStatus
  liveMode: boolean
  connectedAt: string
  currency: string
  listingIds: string[]
  notes?: string
  publicKey?: string
  secretKey?: string
  webhookSecret?: string
}

export interface PayoutAccountDraft {
  accountName: string
  publishableKey: string
  secretKey: string
  clientId: string
  activeSecretKey: string
  publicKey: string
  webhookSecret: string
}

export const payoutProviderLabels: Record<PayoutProvider, string> = {
  stripe: 'Stripe',
  doku: 'Doku',
  xendit: 'Xendit',
}

export const payoutProviders: PayoutProviderConfig[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    icon: 'simple-icons:stripe',
    description: 'Use Stripe for card processing and direct payouts to your connected account.',
    connectCopy: 'Connect a Stripe payout account, then assign listings that should settle into this account.',
    fields: [
      {
        key: 'publishableKey',
        label: 'Publishable key',
        placeholder: 'pk_live_...',
        helper: 'Required for client-side Stripe initialization.',
      },
      {
        key: 'secretKey',
        label: 'Secret key',
        placeholder: 'sk_live_...',
        helper: 'Used to authenticate server-side payout and payment actions.',
        secret: true,
      },
    ],
    steps: [
      'Paste your Stripe publishable key and secret key.',
      'Save the account and confirm the connection status.',
      'Assign the listings that should use this payout account.',
    ],
  },
  {
    id: 'doku',
    name: 'Doku',
    icon: 'lucide:badge-indian-rupee',
    component: 'SettingsIconsDokuLogo',
    description: 'Connect Doku for local card and payment methods used by Indonesian guests.',
    connectCopy: 'Use your Doku API credentials, then map listings to this payout account.',
    fields: [
      {
        key: 'clientId',
        label: 'ClientID',
        placeholder: 'Your Doku ClientID',
        helper: 'Shown in Doku as ClientID. We treat this as the public identifier.',
      },
      {
        key: 'activeSecretKey',
        label: 'ActiveSecretKey',
        placeholder: 'Your Doku ActiveSecretKey',
        helper: 'Keep this private. It is used as the secret key in Elev8.',
        secret: true,
      },
    ],
    steps: [
      'Copy ClientID and ActiveSecretKey from Doku.',
      'Save the account in Elev8.',
      'Assign one or more listings to this payout account.',
    ],
  },
  {
    id: 'xendit',
    name: 'Xendit',
    icon: 'lucide:badge-dollar-sign',
    component: 'SettingsIconsXenditLogo',
    description: 'Connect Xendit for payments, webhooks, and settlement handling.',
    connectCopy: 'Add your Xendit keys and webhook secret, then route listings to the account.',
    fields: [
      {
        key: 'secretKey',
        label: 'SecretKey',
        placeholder: 'xnd_development_...',
        helper: 'Your main Xendit secret key for server-side requests.',
        secret: true,
      },
      {
        key: 'publicKey',
        label: 'PublicKey',
        placeholder: 'xnd_public_...',
        helper: 'Used for public client operations and verification.',
      },
      {
        key: 'webhookSecret',
        label: 'WebhookSecret',
        placeholder: 'Webhook verification token',
        helper: 'Used to verify incoming Xendit webhook signatures.',
        secret: true,
      },
    ],
    steps: [
      'Copy the SecretKey, Keyname, PublicKey, and WebhookSecret from Xendit.',
      'Save the account in Elev8 and verify the webhook endpoint.',
      'Assign listings that should settle through this Xendit account.',
    ],
    webhookHint: 'Make sure your webhook verification token matches the one configured in Xendit.',
  },
]

export const payoutAccounts = ref<PayoutAccount[]>([
  {
    id: 'pay-1',
    provider: 'stripe',
    accountName: 'Stripe Bali Main',
    status: 'connected',
    liveMode: true,
    connectedAt: '2026-06-03',
    currency: 'USD',
    listingIds: ['lst-1', 'lst-2', 'lst-18'],
    notes: 'Primary global card gateway.',
    publicKey: 'pk_live_91f4...c8a2',
    secretKey: 'sk_live_91f4...ab91',
  },
  {
    id: 'pay-2',
    provider: 'doku',
    accountName: 'Doku Domestic Settlement',
    status: 'needs_setup',
    liveMode: false,
    connectedAt: '2026-06-10',
    currency: 'IDR',
    listingIds: ['lst-3'],
    notes: 'Waiting for final secret key verification.',
    publicKey: 'doku-client-7812',
    secretKey: 'active-secret-***',
  },
  {
    id: 'pay-3',
    provider: 'xendit',
    accountName: 'Xendit Reserve Account',
    status: 'needs_webhook',
    liveMode: true,
    connectedAt: '2026-06-12',
    currency: 'IDR',
    listingIds: ['lst-4', 'lst-5'],
    notes: 'Webhook endpoint not validated yet.',
    publicKey: 'xnd_public_2d91...',
    secretKey: 'xnd_sk_2d91...',
    webhookSecret: 'whsec_8a2d...',
  },
])

export function createEmptyPayoutDraft(): PayoutAccountDraft {
  return {
    accountName: '',
    publishableKey: '',
    secretKey: '',
    clientId: '',
    activeSecretKey: '',
    publicKey: '',
    webhookSecret: '',
  }
}

export function getPayoutProvider(provider: PayoutProvider) {
  return payoutProviders.find(item => item.id === provider) ?? payoutProviders[0]
}

export function getPayoutProviderAccounts(provider: PayoutProvider) {
  return payoutAccounts.value.filter(account => account.provider === provider)
}

export function getListingName(listingId: string) {
  return listings.value.find(listing => listing.id === listingId)?.name ?? listingId
}
