# Attendance (`/attendance`)

> Who clocked in and out, per day. Structure follows the v2 dashboard (`pages/attendances`: a record list with date range, search, export and a detail panel), rebuilt on the new design system. Mock/demo: records are generated, nothing is sent anywhere. Staff clock in from the mobile app, so this page is read-only.

## Pages and components
- `app/pages/attendance/index.vue`: header with the range bar and **Export to .xlsx**; a summary card (Clocked in, On time %, Late check-ins, Early check-outs, Days absent); a toolbar (search staff, role, status, location, clear); a sortable table (Date, Staff, Role, Location, Check in, Check out, Worked) and a pager. The Late and Early summary cells toggle the status filter. Opens on **Today** (the day-to-day question is who is in).
- `app/components/attendance/AttendanceDetailSheet.vue`: right sheet from a row: person, WhatsApp link, working hours (or Flexible), time worked, check in/out with Late/Early badges, location, notes, check-in and check-out photos, links to `/users/<id>` and `/activities/<id>`.
- The range bar is `activities/ActivitiesRangeBar.vue`, now with optional `selection` (v-model) and `earliest` props. Without them it drives the Activities range, as before.

## Data and state
- `app/components/attendance/data/attendance.ts`: `AttendanceRecord { id, userId, date, listingId, clockIn, clockOut?, clockInLate, clockOutEarly, clockInNote?, clockOutNote? }`, `shiftFor(userId)` (shift per seed user, `flexible` shifts are never late or early), `buildSeedAttendance(now, people)`, `workedMinutes`, `formatWorked`.
- `useAttendanceReport()` (`useState('attendance-records')`, `'attendance-range'`): `rows(range, filters)`, `totals(range, filters)`, `staffSummaries(range, filters)` (export), `earliestDate`, `selection`.
- Export (`app/lib/attendance-export.ts`, `write-excel-file` on demand): one row per person with totals, then a "D Mon in" and "D Mon out" column for every day somebody clocked in. File `attendance-<from>_<to>.xlsx`.

## Rules and gotchas
- **A day has one record per shift** (`segment` 1, 2, 3 or 4; see `schedule.md`). A check-out after midnight keeps the clock time and sets `clockOutNextDay` (`+1` in the table).
- **An absence is a missing record**, not a row: a **scheduled** working day (`useSchedule`, see `schedule.md`: role hours, the person's own days, dated days off) up to **yesterday**, from the person's first record on, with no record. Today is never absent (the day is not over). A **listing or status filter hides absences** (an absence has no place).
- **Late / early** use a 10 minute grace (`ATTENDANCE_GRACE_MINUTES`). **No check-out** only counts on past days, so someone still working today is not flagged. Today's records are clocked out only once the shift is over (relative to the time the data was built).
- Seed data covers the last 90 days **relative to today**, deterministic (seeded PRNG), limited to each user's `listingIds`, Sundays off, about 1 working day in 14 absent, inactive people have none. It is rebuilt on each load: nothing is saved, because the page cannot change a record.
- ⚠️ **Separate from the profile's Attendance tab.** `/users/<id>` still reads `useUserAttendance` (`users/data/user-attendance.ts`, a fixed 14-day window from 2026-07-15), so its numbers do not match this page. Moving the profile onto this report is the follow-up.
- Dates are local `YYYY-MM-DD` keys (`toLocalDateKey`), never `toISOString()`.
- **Photos**: `clockInPhoto` / `clockOutPhoto` only say a selfie exists (about 6% have none; no check-out means no check-out photo). The mock has no files, so `attendancePhotoUrl` draws a placeholder SVG data URL (initials, check in/out, time, place) when the sheet opens, keeping the saved records small. The sheet's **View photo** buttons open the shared `inbox/ImageViewer` under its own scope `attendance` (`useImageViewer('attendance')`), so the inbox viewer never pops too. Photos use their own seeded generator, so other values did not change. **One demo record** (the latest finished day of `user-1`, `DEMO_PHOTO_USER_ID`) carries real files (`clockInPhotoUrl` / `clockOutPhotoUrl` = `/avatars/avatartion.png`); the sheet prefers a stored URL over the placeholder. A real build swaps `attendancePhotoUrl` for the stored file URL.
- Not built yet: manual corrections, per-person detail page. Shifts and days off now live in `/schedule` (`docs/claude/schedule.md`). Permission module `attendance_log` exists in the role matrix but this page is not gated yet.
- Menu: Operations, after Activities.
- Tests: `tests/composables/useAttendanceReport.spec.ts`.
