> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Journeys Module (`app/components/journeys/`)

AI-powered multi-step guest communication automation. Replaces Dynamic Templates as the primary automation surface.

#### Data + Types (`app/components/journeys/data/journeys.ts`)
- Types: `Journey`, `JourneyStep` (union of `TriggerStep | WaitStep | MessageStep | ContextCheckStep | ActionStep`), `MarketplaceTemplate`
- Step types: `trigger` (purple), `wait` (gray), `message` (green), `context_check` (amber), `action` (red)
- Mock data: `mockJourneys` (4 journeys), `marketplaceTemplates` (4 templates), `generatedJourneyExample`
- `generatedJourneyExample` includes `aiReasoning: string` and `stats: { messages, contextChecks, estimatedTime }`

#### Composable (`app/composables/useJourneys.ts`)
- `journeys` — `useState<Journey[]>` with spread syntax mutations
- `toggleStatus(id)`, `saveJourney(journey)`, `deleteJourney(id)`

#### Components
- **JourneyList.vue** — Table of journeys with inline Switch toggle, status Badge, DropdownMenu (Edit/Delete), empty state
- **JourneyBuilderPrompt.vue** — Screen 1: textarea + example chips + 2×2 template grid
- **JourneyBuilderGenerating.vue** — Screen 2: 5-step animated progress (600ms per step), gold spinner for active step, emits `done(journey)` with `generatedJourneyExample`
- **JourneyBuilderReview.vue** — Screen 3: two-column step list + AI reasoning/stats/refine sidebar
- **JourneyEditor.vue** — Two-column editor: step timeline (left) + JourneyStepSidebar (right), inline editable journey name, Active switch, Save button, Add Step dropdown
- **JourneyStepCard.vue** — Step card with colored icon circle, HostBuddy AI gold badge on message steps, WhatsApp warning tooltip, hover trash button, connecting dashed line
- **JourneyStepSidebar.vue** — Dynamic form per step type (trigger/wait/message/context_check/action), emits `update(step)` on every change
- **JourneyMarketplace.vue** — Category filter tabs, 2-col grid, Preview Dialog (non-interactive step list), Install button

#### Page (`app/pages/journeys/index.vue`)
View states: `'list' | 'marketplace' | 'builder-prompt' | 'builder-generating' | 'builder-review' | 'editor'`
Flow: list → builder-prompt → builder-generating → builder-review → editor → (save) → list

#### Nav
Smart Flow section in `app/constants/menus.ts` — Journeys (`i-lucide-route`) + Templates
