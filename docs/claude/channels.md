> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Channels (`/channels`)

Connect OTA accounts, then choose which listings each OTA sells. Mock only: connecting an account or a listing is a timer, not a channel manager call.

#### Files
- `app/components/channels/data/channels.ts`: `CHANNELS` catalog (Airbnb, Booking.com, Vrbo, Expedia, Agoda, Trip.com, Google Vacation Rentals), `ChannelAccount`, `ChannelMapping`, `getChannel()`, `otaIcon()`. Imports nothing, so anything can import it without a cycle.
- `app/components/channels/data/format.ts`: `formatSyncTime()` for "Last sync".
- `app/composables/useChannels.ts`: `accounts` (`useState('channel-accounts')`) and `mappings` (`useState('channel-mappings')`), plus connect, disconnect, resync and update actions.
- `app/pages/channels/index.vue`: accounts only (no per-listing table): header, `ChannelSummary`, `ChannelAccountsSection`, and `ChannelMappingDialog` for the summary error rows.
- `ChannelSummary.vue`: one sentence on coverage plus a row per sync error with "Fix mapping".
- `ChannelAccountsSection.vue`: a `ChannelAccountCard` for each **connected** channel only, plus an "Add channel" button (an empty state with the same button when none are connected). It owns `ChannelPickerDialog` (every channel, connected ones first with a Connected badge and account count; picking one opens `ChannelConnectDialog`, which becomes "Add another X account" for a connected channel), `ChannelAccountsSheet`, `ChannelImportDialog` and the disconnect-account confirm.
- `ChannelAccountCard.vue`: connected channels only, fixed height. It shows listing count and account count (or error count) and a "Manage accounts" button, never the account list, because a channel can have many accounts.
- `ChannelAccountsSheet.vue`: the account list for one channel: "N of M listings on <channel>" in the header, then per account the property id, listing count, errors, disconnect, and "Add account".
- **Per-listing status lives on the Listings pages, not here.** `ListingOtaCell` (Listings table) adds a status dot per OTA icon (green live, amber syncing, red error) with a tooltip naming the account and error. `ListingChannelsCard.vue` (listing detail, Settings tab, replaces the old Distribution Channels card) lists every connected channel with account, last sync, error text and a `ChannelMappingCell` chip or Connect button that opens `ChannelMappingDialog`.
- `ChannelMappingDialog.vue`: one listing on one channel: account, external id, resync, disconnect.
- **Map listings flow** (`ChannelImportDialog.vue`, rows `ChannelImportRow.vue`, picker `ChannelListingPicker.vue`): opens right after an account connects (`ChannelConnectDialog` emits `connected`) and from the account menu in `ChannelAccountsSheet`. It fetches the account's OTA listings (`fetchRemoteListings`, mocked: the linked ones, up to 4 unlinked, and one "Kuta Beach Studio" with no Elev8 match), pre-fills a suggestion per unlinked listing, and connects the confirmed picks with the OTA listing id as `externalId`.
- Matching lives in `data/remote-listings.ts` (pure, tested): Dice score over title + location words minus stopwords; `suggestMatch` returns null below `MATCH_THRESHOLD` or on a tie (no guess beats a wrong guess); `suggestMatches` hands each Elev8 listing to at most one OTA listing, closest match first. The picker disables listings already on the channel (with the account it is on) or chosen in another row.
- `getMapping()` reads a keyed `Map` index, because every Listings table row asks for every channel.

#### Rules
- **Many accounts per channel**: `ChannelAccount` has its own `id`; a channel can have several (e.g. one Airbnb host login per owner or region). `ChannelMapping.accountId` says which account a listing syncs through. A listing is on a channel through **at most one** account (mapping key stays `listingId|channel`), or it would be sold twice. `connectListings(accountId, …)` skips listings already on that channel through any account; `moveToAccount(mappingId, accountId)` switches account (re-pushed, `syncing` then `active`).
- `propertyId` (property-id channels) is unique per channel: `isPropertyIdTaken()` blocks the dialog and `connectAccount` returns `null`. When adding a second account the name is required and must be unique on the channel, because it is what staff see in cells and pickers.
- `disconnectAccount(accountId)` only unpublishes that account's listings; other accounts on the channel stay.
- `ChannelMappingCell` names the account under the chip only when given `accountName`. The mapping dialog picks an **account** when a channel has several.
- Seeding: listings of property `Elev8 Suite DACH` sit on a second Airbnb and a second Booking.com account; everything else on `Elev8 Bali Villas`.
- **One writer**: `useChannels` is the only writer of `Listing.otaConnected`. After every mapping change it rewrites the field to the channels the listing has a mapping on, in `CHANNELS` order. Listings index, expand row and the listing Settings tab only read it.
- Channel names are the strings already stored in `otaConnected` (`'Airbnb'`, `'Booking.com'`, `'Vrbo'`). Do not rename them.
- Seeding: accounts are seeded for every channel some listing already uses; mappings are seeded from `otaConnected` as `active`. The first Booking.com mapping is seeded as `error` so the error state is visible.
- Connect methods: `oauth` (sign-in, no id) or `property_id` (needs the account-level property id). A listing's external id is optional; empty means auto-matched (`mockExternalId`).
- `connectListings` skips listings already on the channel and refuses a channel with no account. Mappings start `syncing` and go `active` after `CHANNEL_SYNC_DELAY_MS`. `resync` clears an error.
- OTA logos: always use `otaIcon(name)`. Vrbo and Agoda have no logo in the bundled collections, so they use `lucide:house` / `lucide:hotel`.
- Per-unit `Unit.otaConnected` overrides are not managed here yet; mapping is per listing.

#### Tests
`tests/composables/useChannels.spec.ts`. `listings` is a module-level ref, so the spec snapshots and restores it per test.
