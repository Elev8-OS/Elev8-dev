> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before wiring `/channels` to NextPax; keep it updated when the code changes.

### NextPax channel connection (spec, not built yet)

How the `/channels` prototype (`docs/claude/channels.md`) should connect to the real NextPax backend. Source of truth is the backend repo `/Users/juli/Desktop/elevate-development`: `app/controller/pms_nextpax.go` (routes), `app/service/pms_nextpax.go` (logic), `app/dto/pms_nextpax.go` and `app/external/nextpax/nextpax_channel_dto.go` (shapes), `docs/nextpax-certification/` (sandbox evidence). Written from reading that code, **not** from calling the sandbox, so every "verify" below is open.

#### Already built: dashboard-v2

`/Users/juli/Desktop/dashboard-v2-development 2` is the production dashboard (Nuxt + Quasar, `tw:` Tailwind prefix, not shadcn), so this is a reference to port from, not code to copy. It already calls the backend described below. Read these before building:
- `pages/nextpax-channel-connect.vue`: channel list. Catalog from `constants/channel-codes` merged with `GET /channels`, "Connected" first, then a searchable "Available" grid that shows a featured set until the host searches. Hides `MAK346`. Deep links to NextPax Matchmaking (`nextpax.app/ui/matchmaking/{pmCode}/scores`) because there is no API for it.
- `pages/nextpax-channel/[code].vue` (1000 lines): one **page per channel**, not a dialog. Its comment says a side panel would become a scroll trap. Sections in order: readiness gates, account details (generated from the definitions, with a free "add another setting" row), payment methods (Booking.com), per-listing overrides, authorisation link, take-over table, "Connect all listings", listing health, "Turn off".
- `pages/nextpax-channel-onboarding.vue`: the Vrbo SSO stepper (`sso-redirect`, then `confirm-mapping`), a separate page because it is Vrbo only.
- `components/ListingV2/NextpaxChannelStatus.vue`: per-listing channel status with `exportFlowStatuses`, `channelPropertyUrl`.
- Other NextPax pages exist (content, rates, rate plans, PM policies, promotions, features, requests). Out of scope here.

What it confirms from the backend reading:
- Manual ids for take-over, no remote listing fetch. Same conclusion as "Map listings" below.
- Unlink via a take-over entry with blank ids, with the refusal shown (Airbnb answers `channelHostId ... cannot be empty`). Turn off via `POST /channels` with `disabled`. Both are called in v2, so the shape is right, but I have not seen them succeed.

What it adds that this spec missed:
- **A third gate: a channel-specific cancellation policy.** `GET /pm-policies`, `channelSpecificCancellationPolicies` must contain the channel, else the page says the channel will not switch on with the account-wide policy alone. Links to the policies page. Add this to the readiness list.
- **Readiness is a checklist** (settings, policy, payments), and "Connect" is disabled until it is complete. Reuse this idea, it is better than my stepper-only plan.
- **Photo minimum warning** before connecting, from `constants/channel-content-definitions` and `GET /properties/:id/images`. A warning, not a gate.
- **Authorisation link is only offered for `AIR298` and `HOM143`**, editable by the host in the dashboard (paste, save, remove), age in days, flagged stale after 14 days (a product choice, not a channel rule). **Decided: the host pastes it, for now.** Operator-generated links in NextPax Core stay the source; a later step can move the paste to an Elev8 operator screen.
- **Listing health shows when each flow last ran** ("3d ago"), so a stale failure is not read as a reaction to a fresh change.
- Per-property rate plan mapping for Booking.com reads `GET /rate-plans` (`rateplans[].supplierRateplanCode`).

What v2 does **not** do, and the prototype can:
- Status is the raw string (`enabled`, `channelPropertyStatus`), shown in a pill with 4 tones (`live`, `pending`, `error`, `off`). There is no mapping to what a host understands, and no polling.
- Health needs a listing picked by hand, no overview of all listings per channel.
- No multi-account concept beyond the property overrides below.

#### Backend facts that shape the UI

- **Base**: `/api/v1/pms/nextpax/*`, JWT auth, tenant from the token (never send a tenant id or PM code). Responses are `{ status, data }`.
- **Gate**: every call fails with `tenant is not provisioned on NextPax` unless `tenants.pms_name = "nextpax"` and a PM code exists. New signups land there when `External.NextPax.EnableOnboarding` is on. Existing Channex tenants move with `POST /pms/nextpax/migrate` (async, progress over the `migrate-pms` websocket event, resumable). Channex tenants keep `/channex/channel/*` (see backend `docs/channex-ota-channel-integration.md`), which is a different flow.
- **One PM per tenant.** NextPax has no "OTA account" object. A channel has one set of PM-level **settings** (credentials) and a PM-level on/off status; each property then has its own channel status and mapping ids.
- **Internal channel `MAK346`** is always enabled and is the default publish target. Never show it as an OTA, never offer to disconnect it. The backend re-forces it on every write.
- **Channel codes are NextPax's**, not our names. Known in code: Airbnb `AIR298`, Booking.com `BOO142`, Vrbo `HOM143`, Expedia `EXP270`. Agoda, Trip.com and Google Vacation Rentals are not hard-coded anywhere: resolve their codes from `GET /constants/channel-codes` at runtime and match by `channelName`. If a name is absent, hide the channel rather than guess a code.
- **No endpoint lists a host's existing OTA listings.** The prototype's `fetchRemoteListings` has no backend equivalent (verified by reading the route table). See "Map listings" below.
- **Rate limit**: NextPax allows one channel status change per 60 s (PM level, and per property). Disable the button while a call is in flight and show the error text if it comes back.

#### Prototype model vs NextPax model

| Prototype | NextPax | Decision |
|---|---|---|
| `ChannelAccount` (many per channel) | PM-level channel settings, one set per channel | **Decided: multi-account is a requirement. The backend does not support it yet** (see "Multi-account"). Build the UI against an account-shaped contract, ship the single-account case first |
| `ChannelMapping` (listing x channel) | per-property channel entry from `GET /properties/:id/channel-status` | Same shape, read from the backend instead of a `useState` seed |
| `externalId` | `channelPropertyId` (+ `channelRoomId`, `channelHostId`) | One id is not enough for Booking.com (hotel id + room id) or Airbnb (listing id + host id). Needs a per-channel id form |
| `status: syncing / active / error` | `channelStatus`, `channelPropertyStatus`, `buildStatus`, `exportFlowStatuses[].lastJobError` | See "Status mapping" |
| `method: 'oauth' / 'property_id'` | three real methods: SSO wizard (Vrbo), stored authorisation link (Airbnb), settings only (rest) | Replace the two-value enum, see below |
| `channelListingUrl()` built from ids | `channelPropertyUrl` on the status row | Use the backend URL, keep the builder only as a fallback for the mock |

#### Connect flow (what the dialog should do, in order)

Per channel, one stepper in place of today's single `ChannelConnectDialog`. Steps a channel does not need are skipped.

1. **Catalog and state.** `GET /constants/channel-codes` (names, logos, website), `GET /channels` (PM status per code), `GET /channel-settings-definitions` (per channel: `settingName`, `settingType`, `settingRequired`, `settingOptions`, `availableOnPropertyLevel`). Render the channel card from the first two, the credentials form from the third. Do not hard-code field labels like `propertyIdLabel` for NextPax.
2. **Host details (credentials).** `GET /channel-settings`, then `POST /channel-settings` with `{ channels: [{ channelCode, settings: [{ settingName, settingValue }] }] }`. NextPax merges per channel. Examples from the backend comments: Booking.com `legal_entity_id` and `pricing_model`, Vrbo `advertiser_id`, Expedia `pricing_model`, Holidu `provider_id`, Marriott HMC id. Required settings come from the definitions, so the form is generated, not written per channel.
2b. **Cancellation policy gate.** `GET /pm-policies`: `channelSpecificCancellationPolicies` must include this channel, else the channel will not switch on (v2 checks exactly this). Link to the policies screen when missing.
3. **Payment methods (Booking.com only).** Booking.com will not activate without at least one accepted payment method: `GET` then `POST /payment-methods` with codes from `GET /constants/mapping-codes` (`paymentMethods`). Show this as a required sub-step inside the Booking.com flow.
4. **Authorise the channel account** (depends on channel):
   - **Vrbo**: `POST /channels/HOM143/sso-redirect` `{ advertiserId, companyName, email }` returns `ssoLinks` (a channel-key to URL map). Open the link, the host signs in, then `POST /channels/HOM143/confirm-mapping` `{ advertiserId, confirmMappingOfPropertyIds }`. **Production only**; the sandbox answers 400 for lack of a live advertiser id (this is in the certification evidence).
   - **Airbnb and the other login-based channels**: the Supply API cannot start the OAuth. An operator generates the link in NextPax Core and stores it with `POST /channels/:channelId/authorisation` `{ url }` (https only, empty string clears it). The dashboard reads `GET /channel-authorisations` (`url`, `setAt`) and shows the button "Sign in with Airbnb" plus the **age** of the link, because these links expire. Empty list means "authorisation link not ready yet, contact Elev8", not an error. Hosts never see NextPax.
   - **Settings-only channels** (Booking.com, Expedia, Agoda, Trip.com, Google): no login step, the settings from step 2 are the authorisation.
5. **Connect.** `POST /channels/:channelId/connect`:
   ```json
   {
     "content_status": "enabled",
     "property_ids": [],
     "take_over": [
       { "property_id": "…", "channel_property_id": "…", "channel_room_id": "…", "channel_host_id": "…",
         "import_content": false, "import_content_scope": [], "channel_rate_plans": [] }
     ]
   }
   ```
   `property_ids` empty means every property of the PM. `take_over` is optional, one entry per property, and only honoured for `BOO142`, `AIR298`, `HOM143`, `EXP270`. The backend does the rest in one call: enable the channel at PM level (merged), create a channel-specific rate plan where the channel accepts one, fill gaps in policies and content, then enable multi-unit **parents before children**. It is a long call, show a progress state.
6. **Read the result per property.** `{ channel_id, enabled, failed, properties: [{ property_id, is_parent, enabled, error?, warnings? }] }`. Per-property failure is expected, not fatal. **Always surface `warnings`**: Booking.com answers 200 and silently drops the channel, and the only trace is in the warnings. A row with `enabled: true` and warnings is **not** live, show it as "Needs attention" with the warning text.
7. **Poll status.** `GET /properties/:propertyId/channel-status` per listing (every few seconds while a connect is open, then on page focus). This is what moves a mapping from syncing to live or error.

Other channel-level calls: `POST /channels/connect-all` is an operator tool that tries every channel and returns `{ enabled, blocked, channels[{ channelId, enabled, reason }] }`. It is not a host-facing button. Use its `reason` text as the model for "what is missing" copy.

#### Map listings (replaces the prototype's `ChannelImportDialog`)

NextPax cannot return the host's OTA listings, so the "fetch, auto-suggest, confirm" screen cannot be backed. Two honest paths per listing, chosen in the connect step:

- **Create new on the channel**: send no `take_over` entry. NextPax builds the listing from our content.
- **Attach to an existing listing** (take-over): the host types the ids the channel shows them. Fields shown depend on the channel: Booking.com hotel id and room id (a multi-unit parent takes no room id, the backend blanks it), Airbnb listing id and host id (no take-over flag is sent), Vrbo and Expedia property id. Optional "Import content from the channel" checkbox (`import_content`, empty scope means all). Optional rate plan pairs (`channel_rate_plans`) for Booking.com so existing plans are reused instead of duplicated.
- **Unlink**: a take-over entry with every id blank. The ids go out empty to clear what NextPax stored.

The Dice-score suggestion in `data/remote-listings.ts` has no data to run on. Keep it only if a source of OTA listing titles appears (for example an Airbnb export the host uploads). Do not fake one.

Matching is per **property**. For a multi-unit listing, parent and unit types each carry their own ids, which fits the open "map room types" note in `channels.md`: with NextPax that stops being optional.

#### Status mapping

| Backend signal | UI status | Label and copy |
|---|---|---|
| connect call in flight, or `channelStatus = enabled` and `buildStatus.isFinished = false` | `syncing` | Syncing |
| `buildStatus.isFinished = true` and no `lastJobError` | `active` | Live |
| `lastJobError` set on `buildStatus` or any `exportFlowStatuses[]`, or a connect warning | `error` | Error, show the text, never a generic message |
| `channelStatus = disabled` or no row | no mapping | Not connected |

`propertyStatusNote` is NextPax's own explanation and can be shown under the chip. `channelPropertyStatus` values are not documented in the code I read: **verify against the sandbox** before keying logic on them. Until then derive status only from `buildStatus`, `exportFlowStatuses` and warnings.

`useChannels` stays the only writer of `Listing.otaConnected`. With the real backend it derives the field from the enabled channel rows of `channel-status`, using the display names already stored (`'Airbnb'`, `'Booking.com'`, `'Vrbo'`).

#### Disconnect and resync

- **Disconnect one listing**: `POST /properties/:propertyId/channels` `{ channels: [{ channelId, channelStatus: "disabled", contentStatus: "enabled" }] }`. The backend merges, so other channels and `MAK346` survive. Inferred from `EnablePropertyChannel` and `mergePropertyChannel`, **verify** that `disabled` is accepted.
- **Disconnect a channel**: `POST /channels` `{ channels: [{ channelId, channelStatus: "disabled" }] }` (merged). Same 60 s limit. The prototype's "disconnect account unpublishes its listings" copy must say that every property on the channel stops selling.
- **Resync**: re-call `POST /channels/:channelId/connect` with `property_ids: [id]`, or `POST /listings/:listingId/sync-content` to push text and photos. Note `sync-content` **replaces** the property's photos and descriptions, so confirm before it, while connect only fills gaps.
- **Move listing to another account**: no equivalent, see the model table.

#### After it is live (not part of Channels, but the same integration)

- Inbound bookings: webhook `POST /webhook/nextpax` (always acks 200, token checked, ingests by booking id) plus the scheduler `POST /scheduler/sync-nextpax-bookings`. Manual `POST /bookings/sync` returns `{ ingested }`.
- Guest messages arrive on the same webhook and are forwarded to the Inbox. Native threads: `/messaging/threads`.
- Request to book: `POST /bookings/:bookingId/change-state` `{ channelId, state: "reservation" | "cancelled", reason }` (reason required to decline). Alterations: `GET /booking-alterations`, `POST /booking-alterations/:id`.
- Availability, rates and restrictions reach the channels through `/properties/:id/availability`, `/rates`, `/rates-los`, and the Cockpit endpoints (`/ari`, `/override`, `/reservation/block`). Channels does not write these.

#### Multi-account

Product decision: a channel can have several accounts (one login per owner or region), a listing is on a channel through one of them. The backend today has none of this:
- `tenant_channel_authorisations` is keyed `(tenant_id, channel_id)`: one authorisation link per channel, covering the whole account.
- PM channel settings are one set per channel. Property-level settings exist (`/properties/:id/channel-settings`) but only for settings flagged `availableOnPropertyLevel`. Which settings those are is **not in the repo, read the definitions response**. Vrbo `advertiser_id` and Expedia `pricing_model` are the two the code comments mention.
- No account entity, no property-to-account relation, no move between accounts.

What the backend needs for real multi-account (to agree with its owner, not assumed):
1. An account entity per tenant and channel (`id`, `name`, credentials or authorisation link, `set_at`), replacing the `(tenant_id, channel_id)` key.
2. A property-to-account relation, one account per property per channel, enforced server-side.
3. `connect` and `authorisation` endpoints that take an `accountId`, and a status response that returns it.
4. NextPax holding two logins of one channel under one PM: **confirmed possible by the product owner.** So no PM-per-account, `nextPaxPMCode` stays. The mechanism is now partly visible in dashboard-v2, as **per-property overrides**:
   - Settings flagged `availableOnPropertyLevel` can be set per property (`POST /properties/:id/channel-settings`). v2's comment: Booking.com `legal_entity_id` names the contracting owner, so a manager with villas owned by different people needs one value per villa, and "cannot be set up at all" without it. Vrbo `advertiser_id` works the same way.
   - Airbnb: `channel_host_id` per listing (v2 labels it a host account that differs from the account-wide one).
   So an "account" in the UI is the **group of listings that share the same override values** (legal entity, advertiser, host id), not a stored entity. No backend account table is needed for these channels.
   Still unverified: that the Airbnb authorisation link (one per tenant and channel) covers more than one host login, and which other channels have `availableOnPropertyLevel` settings (read the definitions response, the list is not in either repo). **Confirm both with NextPax before building the account step.**

UI consequences, kept as the prototype has them: account step in the wizard (pick or add, name required and unique per channel), account name under the chip, "Move to account", `ChannelAccountsSheet`. Until the backend ships, the real path exposes exactly one account per channel (name fixed to the tenant name) and hides "Add another account" and "Move". The mock path keeps everything.

#### Built in the prototype so far

Redesigned from v2's 10 "Elev8" pages into 4 places (flow diagram: the Claude doc "NextPax Channels: Simplified Flow"). **Phase 1, Channels, is built**, mock only, shaped like the backend so a real client can replace `useChannelSetup` internals. See `docs/claude/channels.md` for files.
- `/channels`, `/channels/<slug>` (listings on a channel with status and actions), `/channels/<slug>/connect` (4-step wizard: Account and sign-in, Readiness, Listings, Connect).
- Every v2 channel capability has a place: generated settings form, Airbnb link, Vrbo SSO + confirm mapping, channel cancellation policy, Booking.com payment methods, photo minimum warning, take-over ids, import content, per-listing setting overrides, connect with per-listing warnings, unlink, resync, turn off.
- Status has 5 states: a connect warning is **Needs attention**, not Error and never Live.
- Booking.com rate plan pairs in Link read the listing's rate plans that sell on Booking.com.
- Not yet: polling, multi-unit parent/unit ids.
- **Phase 2a, Listing detail, is built**: Listing > Channels tab (status per channel, add scoped to the listing, content check per channel linking to Listing Setup, send content). **Phase 2b is built** too: photo type and caption, descriptions per language and nearby places in Listing Setup (`docs/claude/listings.md`, "Channel content"), shaped like `properties/:id/images`, `descriptions` and `nearest-places`.
- **Phase 3, pricing, is built in the listing's Pricing tab** (not `/revenue`, which is Listing Health): rate plans get channels + code, channel promotions, channel price adjustments (rate/fee multipliers), copy to listings; currency conversion is an account switch on `/channels`. See `docs/claude/channels.md` "Pricing for channels". Not built: Reconline GDS rate level / guarantee type, the full-replace raw rates and availability editor (Cockpit and pricing already write ARI).
- **Phase 4, Reservations and Inbox, is built**: request to book and Airbnb alterations with Accept / Decline, Sync bookings, webhook health on `/channels`. See `docs/claude/channel-requests.md`. All four phases of the simplified flow are now in the prototype.

#### Suggested build order

1. `useNextPaxChannels` composable with a typed client for the calls above, behind a flag so the mock `useChannels` keeps working for demo tenants. Keep `ChannelAccount` and `ChannelMapping` as the view model so the Listings pages do not change.
2. Read path first: catalog, PM channel status, per-property `channel-status` into the existing cards and `ListingChannelCell`. No writes yet.
3. Credentials form generated from `channel-settings-definitions`, then Booking.com payment methods.
4. Connect with create-new, per-property result list with warnings.
5. Take-over id form, unlink.
6. Authorisation: stored-link button with link age (Airbnb), SSO wizard (Vrbo, production only).
7. Status polling, disconnect, resync.

#### Open questions for the backend owner

1. Which `channelPropertyStatus` values exist, and which one means live?
2. Is `channelStatus: "disabled"` accepted on a property, and what happens to existing reservations?
3. Does `connect-all` hit the 60 s PM limit when it posts one channel after another?
4. Agoda, Trip.com and Google Vacation Rentals: are they distributable through NextPax, and under which codes?
5. Who generates the Airbnb authorisation link in NextPax Core today, and is there a plan for an API so the host can self-serve?
6. Multi-account per channel is a requirement. Does the Airbnb authorisation link cover several host logins, and which channels' settings are `availableOnPropertyLevel`? See "Multi-account".
8. Channel codes seen in v2's featured list: `AGO304`, `CTR342`, `HTG276`, `MAR392`, `HOL303`, `REC992`. Only `MAR392` (Marriott) is labelled there. Names for the rest, and whether Google Vacation Rentals exists, come from `channel-codes` at runtime.
7. The webhook payload shape is a best guess in the backend (`nextPaxWebhookPayload`), finalised from live traffic. Not a Channels concern, but it gates real-time status.
