> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Channel requests: request to book and guest changes (NextPax phase 4)

What a channel waits for the host to answer, in Reservations and the Inbox. Mock only: each answer is a timer shaped like NextPax `POST /bookings/:id/change-state` (`reservation` | `cancelled` + reason) and `POST /booking-alterations/:id`.

#### Model
- **`ReservationStatus` `'request'`** ("Request to book", sky dashed badge). Comes only from a channel: the reservation sheet's status Select hides it and is disabled while a stay is a request. `requestExpiresAt` = when the channel withdraws it (24 h, `REQUEST_ANSWER_HOURS`). A request holds the dates.
- **`ReservationEntry.alteration`** (`BookingAlteration`: new dates, guest count, total, the guest's note, the channel's id). Airbnb only, as in NextPax. Present = waiting for an answer.
- Pure rules `reservations/data/channel-requests.ts`: `DECLINE_REASONS` (6, some per channel: Airbnb "waiting for a better reservation", Booking.com "details incomplete" and "outside check-in hours"), `declineReasonsFor`, `needsAnswer`, `requestTimeLeft`, `alterationChanges` (only the fields that change).
- Seeds: `res-req-1` (Erik Hoffmann, Airbnb, lst-3, in 20 days) and an alteration on `res-1` (Sarah Mitchell asks to add a guest, USD 750 to USD 810; res-1 is `conv-1` in the Inbox).

#### Actions (`useChannelRequests`, writes through `useReservationsModule`)
- `acceptRequest`: refuses when another stay now holds the dates (`newReservationConflicts`, names the guest), else status `unverified` (paid means unverified) + activity "Request accepted".
- `declineRequest(id, reason)`: reason required, status `cancelled` + activity naming the reason.
- `acceptAlteration`: checks new dates the same way, rewrites dates, nights, guests, total, clears `alteration`. `declineAlteration`: clears it, the booking stays.
- `syncBookings` (mock `POST /bookings/sync`): one new Airbnb request (James Carter, lst-4) the first time per session, then 0; raises `BOOKING_REQUEST_RECEIVED`.
- `pending`: requests first, then alterations.

#### UI
- `ChannelRequestActions.vue`: Accept / Decline; declining a request opens the reason dialog (radio list for that channel), declining a change does not ask.
- `ChannelRequestBanner.vue`: request (time left, guest message) or change (old struck through, new in bold). In `ReservationDetailSheet` above the guest, and in the Inbox `ReservationPanel` above the guest card (matched to the module stay by id).
- `ChannelRequestsList.vue`: "Needs an answer" with a count, top of `/reservations`, rows open the sheet and answer in place.
- `/reservations` header: **Sync bookings** (spinner, toast with the count).
- Bell: `BOOKING_REQUEST_RECEIVED`, `BOOKING_ALTERATION_REQUESTED` in `GUEST_ACTIVITY_TYPES`, routed to `/reservations`.
- `/channels` "For every channel": **Bookings and guest messages** health (the webhook, set up on provisioning; `useChannelFeatures().webhook`) with **Set up again** (mock `POST /webhook/subscribe`).

#### Not built
Inbox conversation status does not turn `action_needed` for a pending request; expiry is shown, not enforced (no timer withdraws a request).

Tests: `tests/lib/channel-requests.spec.ts`, `tests/composables/useChannelRequests.spec.ts`, `tests/components/reservations/ChannelRequestActions.spec.ts`.
