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
- **Per-listing status lives on the Listings pages, not here.** `ListingChannelCell` (Listings table, one column per channel) shows a status dot and label (green live, amber syncing, red error) with a tooltip naming the account and error. `ListingChannelsCard.vue` (listing detail, Settings tab, replaces the old Distribution Channels card) lists every connected channel with account, last sync, error text and a `ChannelMappingCell` chip or Connect button that opens `ChannelMappingDialog`.
- `channelListingUrl(channel, externalId, propertyId)` (`data/channels.ts`, spec `tests/lib/channel-listing-url.spec.ts`): the public OTA page for a mapped listing, used by the Cockpit header row (`CockpitChannelLinks`). Airbnb and Vrbo use the listing's external id; Booking.com, Expedia, Agoda and Trip.com the account's property id (so listings on one Booking.com account open the same property); null for Google or a missing id. `roomTypeExternalId(listingId, typeId, channel)` (`useChannels.ts`) derives a stable mock OTA id per room type for the Cockpit room type rows, because mappings are still per listing.
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
- Per-unit `Unit.otaConnected` overrides are not managed here yet; mapping is per listing. ⚠️ Real channels map **room types** (the Cockpit already shows links per room type); moving mappings to room type level here is still open.

#### Website channel
Direct bookings on the tenant's own websites (Website Builder) and booking widgets. It has no OTA account, so it is **not** in `CHANNELS`, never writes `Listing.otaConnected` and gets no OTA column (the Listings table has its own "Website" column, see `docs/claude/listings.md`).
- **Rule sets, assigned to websites, not listings.** The channel holds rule sets the way an OTA holds accounts. Each has a name, `websiteIds` and its settings: length of stay tiers, early bird / last minute, min/max stay, booking notice, arrival/departure weekdays, prepayment %. Listings come from the website itself (`getListingIdsForWebsite`), never stored here; a site with no `propertyIds` shows "Listing coverage not set".
- **One website, one rule set, no Default.** A rule set needs a unique name and at least one website. `upsertRuleSet` moves a site out of any other set on save. A site in no rule set (`unassignedWebsiteIds`, `ruleSetForWebsite` returns undefined) takes direct bookings without Website discounts or rules; the sheet list names those sites. Deleting a set leaves its sites in none.
- **Promo codes are not part of a rule set.** Promo Codes owns where a code works (`channelRestriction`); the editor only lists the codes valid on its sites (`isPromoCodeValidOnWebsite` in `promo-codes.ts`) with a link to Promo Codes. Older saves with `promoCodeIds` are cleaned by `parseWebsiteState`.
- `data/website-channel.ts`: types, `WEBSITE_CHANNEL`, module-level ref `websiteChannel` (`{ enabled, ruleSets }`, read outside setup by the widget preview builder), `ruleSetIssues()`, `ruleSetSummary()`, `parseWebsiteState()`. Imports nothing from Website Builder.
- `useWebsiteChannel()` is the only writer: `saveRuleSet()` (returns issues, saves nothing when there are any; **saving the first rule set is what adds the channel**), `deleteRuleSet()`, `assignWebsite(websiteId, ruleSetId | null)` (Website Builder, one site at a time), `disable()` (keeps rule sets), `enable()` (re-add). Saved to localStorage (`elev8-website-channel`); every page that reads it calls `hydrate()` in `onMounted` so SSR and the first client render match.
- UI: first row of `ChannelPickerDialog` (emits `pickWebsite`). Adding opens `WebsiteChannelSheet` with `start="new"`: name + pick websites + settings, button "Add channel"; cancelling adds nothing. The card's "Manage rule sets" opens the list. Editor `WebsiteRuleSetForm` works on a draft, saved only on Save, and ends with `WebsitePriceCheck`.
- Rules: discounts are **percent only** (listings sell in different currencies). Last minute must end before early bird starts.

#### Website price (`data/website-quote.ts`, `useWebsiteQuote`)
- `websiteQuote(input)` is pure; `useWebsiteQuote().quoteStay({ listingId, checkIn, checkOut, bookedOn, ruleSet })` feeds it: nightly prices from the room's revenue policy (`previewPolicy` from the booking day, so policy last-minute rules see the real lead time), the unit type's `lengthOfStayDiscounts` and the policy's weekly / monthly %. A listing with units is priced on its first room.
- **Which discount wins.** With a rule set, its highest tier reached **replaces** the listing tiers and the policy weekly / monthly %; early bird **or** last minute is added; every discount is off the stay subtotal. Without a rule set, the single biggest of the listing tiers and the policy weekly / monthly % (never stacked).
- Rounded per currency, no conversion. `blockers` lists the stay rules a stay breaks; `prepayment` is the rule set's % of the total.

#### Booking widgets
- `BookingWidgetConfig.websiteRuleSetId` (null = the widget's own). `resolveWidgetBookingRules()` (used by `buildEmbedPreview`) returns the rule set's tiers, early bird / last minute, min/max stay, booking notice, arrival/departure days and prepayment wholesale, while the channel is added and the set exists; otherwise the widget's own. Seasonal arrival rules stay the widget's and narrow the rule set's days.
- `WidgetRuleSetSelect` ("Booking rules") is shared by the v1 editor (top of Pricing & Fees; prepayment, booking notice and stay discounts then read from the set) and v2 (own card, "No discounts or stay rules" when none). It says so when a picked set was deleted. The preview's sidebar names the source.

#### Elsewhere
- Website Builder shows and sets a site's rule set (through `assignWebsite`), Listings show which websites sell a listing, reservations keep a frozen `websiteBooking` snapshot, Analytics splits Direct by website. See those module docs.
- Revenue → Channel markups keeps one "Direct" row for every website. No markup per rule set yet: the rule set's discounts already cover website pricing.

#### Tests
`tests/composables/useChannels.spec.ts`, `tests/lib/website-channel.spec.ts`, `tests/lib/website-quote.spec.ts` and `tests/components/channels/WebsiteChannelSheet.spec.ts` (reset `websiteChannel` and its localStorage key by hand). `listings` is a module-level ref, so the spec snapshots and restores it per test.
