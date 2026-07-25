// Barrel exports for the Owner domain data layer.
// Keep this file as the single import surface for downstream consumers.

export type { CommissionRule, CommissionTier } from './commission-rules'
export { mockCommissionRules } from './commission-rules'

export type {
  OwnerLedgerEntry,
  OwnerLedgerSource,
  OwnerLedgerSourceBreakdown,
  OwnerLedgerUpcomingReservation,
} from './owner-ledger'
export { mockOwnerLedgerEntries } from './owner-ledger'

export type {
  OwnerDashboardField,
  OwnerPermissionConfig,
  OwnerPermissionTemplateId,
  OwnerStatementField,
} from './owner-permissions'
export {
  buildOwnerPermissionConfig,
  buildOwnerPermissionTemplate,
  mockOwnerPermissions,
  normalizePermissionsSeed,
  ownerDashboardFieldLabels,
  ownerPermissionTemplates,
  ownerStatementFieldLabels,
} from './owner-permissions'

export type {
  OwnerStatement,
  OwnerStatementIssue,
  OwnerStatementLine,
  OwnerStatementLineCategory,
  OwnerStatementStatus,
} from './owner-statements'
export { mockOwnerStatements } from './owner-statements'

export type {
  OwnerStay,
  OwnerStayStatus,
  OwnerStaySyncState,
  OwnerStaySyncTarget,
} from './owner-stays'
export { mockOwnerStays, ownerStaySyncTargetLabels } from './owner-stays'

export type {
  Owner,
  OwnerLanguage,
  OwnerPropertyMapping,
  OwnerStatus,
  StatementCurrency,
} from './owners'
export { mockOwnerPropertyMappings, mockOwners } from './owners'

export type {
  OwnerReservation,
  OwnerReservationType,
  OwnerReservationChannel,
  OwnerReservationStatus,
  OwnerReservationBar,
  OwnerReservationDay,
  OwnerRoomType,
  OwnerRoom,
} from './owner-reservations'
export { mockOwnerReservations, mockOwnerRoomTypes, mockOwnerRooms } from './owner-reservations-seed'
