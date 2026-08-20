// Barrel exports for the Owner domain data layer.
// Keep this file as the single import surface for downstream consumers.

export type { CommissionRule, CommissionTier } from './commission-rules'
export { mockCommissionRules } from './commission-rules'

export type {
  OwnerDocument,
  OwnerDocumentCategory,
  OwnerDocumentUploadInput,
  OwnerDocumentVisibility,
} from './owner-documents'
export {
  documentCategoryIcons,
  documentCategoryLabels,
  mockOwnerDocuments,
} from './owner-documents'

export type {
  OwnerLedgerEntry,
  OwnerLedgerSource,
  OwnerLedgerSourceBreakdown,
  OwnerLedgerUpcomingReservation,
} from './owner-ledger'
export { mockOwnerLedgerEntries } from './owner-ledger'

export type {
  MaintenanceOwnerApproval,
  MaintenanceRecord,
  MaintenanceRecordInput,
  MaintenanceStatus,
  OwnerMaintenanceConfig,
} from './owner-maintenance'
export {
  mockMaintenanceRecords,
  ownerMaintenanceApprovalLabels,
  ownerMaintenanceConfig,
  ownerMaintenanceStatusLabels,
} from './owner-maintenance'

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
  PortalAccessAction,
  PortalAccessLogEntry,
  PortalAccessStatus,
} from './owner-portal-access'
export {
  mockPortalAccessLogs,
  portalAccessActionLabels,
} from './owner-portal-access'

export type {
  OwnerReservation,
  OwnerReservationBar,
  OwnerReservationChannel,
  OwnerReservationDay,
  OwnerReservationStatus,
  OwnerReservationType,
  OwnerRoom,
  OwnerRoomType,
} from './owner-reservations'
export { mockOwnerReservations, mockOwnerRooms, mockOwnerRoomTypes } from './owner-reservations-seed'

export type {
  OwnerStatement,
  OwnerStatementIssue,
  OwnerStatementLine,
  OwnerStatementLineCategory,
  OwnerStatementStatus,
} from './owner-statements'
export { mockOwnerStatements } from './owner-statements'

export type {
  OwnerStayApprovalRequest,
  OwnerStayApprovalRequestStatus,
} from './owner-stay-approvals'
export {
  isHighSeasonRange,
  mockOwnerStayApprovals,
  ownerStayApprovalSyncTargets,
} from './owner-stay-approvals'

export type {
  OwnerStay,
  OwnerStayApproval,
  OwnerStayCancelRequest,
  OwnerStayCleaningTaskIds,
  OwnerStaySource,
  OwnerStayStatus,
  OwnerStaySyncState,
  OwnerStaySyncTarget,
} from './owner-stays'
export {
  CANCEL_CUTOFF_HOURS,
  mockOwnerStays,
  ownerStayStatusLabels,
  ownerStaySyncTargetLabels,
} from './owner-stays'

export type {
  Owner,
  OwnerLanguage,
  OwnerMagicLinkStatus,
  OwnerPropertyMapping,
  OwnerStatus,
  StatementCurrency,
} from './owners'
export { mockOwnerPropertyMappings, mockOwners } from './owners'
