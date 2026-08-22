# Task 5 Report — PreviewStep: accept reviews, show summary, persist

## What I implemented
- Added `ReviewSelection` type import to `app/components/website-builder/steps/PreviewStep.vue`
- Added `reviews: ReviewSelection` prop to `defineProps`
- `persistWebsite()`: both edit-mode merge and create-mode push now write `reviewIds: props.reviews.selectedReviewIds` and `manualReviews: props.reviews.manualReviews`
- Added a "Guest Reviews" summary card in the template (between Selected Content card and Navigation): total count of selected + manual reviews, "Edit" button emits `goToStep(3)`, manual review chips with rating/name/Manual badge

## Verification results
- `pnpm exec eslint --fix app/components/website-builder/steps/PreviewStep.vue` → exit 0 (clean after auto-fix of import order + template line breaks)
- `pnpm exec vue-tsc --noEmit` filtered for `PreviewStep` → no errors

## Files changed
- `app/components/website-builder/steps/PreviewStep.vue`

## Self-review findings
- Matches the brief exactly. Edit-mode merge preserves existing fields via spread; create-mode push includes thumbnail + new review fields.
- Lint auto-fixed import order (internal-type before external `vue-sonner`) and singleline-html-element-content-newline warnings — same pattern as prior tasks.

## Any issues or concerns
- None.
