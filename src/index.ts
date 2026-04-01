// @sanetti/sanity-sdk-table-kit — SDK-native integration layer
// Re-exports everything from @sanetti/sanity-table-kit + SDK additions

// Re-export base table-kit
export {
  DocumentTable,
  BadgeCell,
  filter,
  useFilterPresets,
  useFilterUrlState,
} from '@sanetti/sanity-table-kit'
export type {BadgeCellProps, BadgeColorMap, BadgeColorMapEntry} from '@sanetti/sanity-table-kit'
export type {
  BaseFilterOptions,
  BaseFilterDef,
  BooleanFilterDef,
  BooleanFilterOptions,
  ColumnDef,
  CustomFilterComponentProps,
  CustomFilterControl,
  CustomFilterDef,
  CustomFilterOptions,
  CustomFilterQueryContext,
  CustomFilterQueryResult,
  CustomFilterValueType,
  DateFilterDef,
  DateFilterOptions,
  SortConfig,
  DocumentBase,
  SelectionConfig,
  DocumentTableProps,
  FieldFilterOptions,
  FieldFilterDef,
  FilterDef,
  FilterKind,
  FilterOperatorByKind,
  FilterOption,
  FilterPreset,
  FilterValueByKind,
  NumberFilterDef,
  NumberFilterOptions,
  ReferenceFilterDef,
  ReferenceFilterOptions,
  ReferenceFilterSourceOptions,
  SearchFieldPath,
  SearchFilterDef,
  SearchFilterOptions,
  StringFilterDef,
  StringFilterOptions,
  UseFilterUrlStateResult,
} from '@sanetti/sanity-table-kit'

// Unified column namespace — base + SDK helpers in one object
export {column} from './column'
export type {PreviewConfig, PreviewValue} from '@sanity/types'

// SDK-specific exports
export {useColumnProjection} from './useColumnProjection'
export {parseFieldExpression} from './useColumnProjection'
export type {
  CellCommentsConfig,
  SanityColumnDef,
  ParsedFieldExpression,
} from './useColumnProjection'
export {resolveColumnAliases} from './resolveColumnAliases'
export {useSanityTableData} from './useSanityTableData'
export type {
  SanityTableDataConfig,
  SanityTableDataResult,
  PaginationState,
  SortingState,
} from './useSanityTableData'
export {useSanityDocumentTable} from './useSanityDocumentTable'
export type {SanityDocumentTableHookResult} from './useSanityDocumentTable'
export {SanityDocumentTable} from './SanityDocumentTable'
export type {SanityDocumentTableProps} from './SanityDocumentTable'
export {PaginationControls} from './PaginationControls'
export type {PaginationControlsProps} from './PaginationControls'
export {PreviewCell} from './PreviewCell'
export type {PreviewCellProps} from './PreviewCell'
export {CommentableCell} from './CommentableCell'
export {CommentInput} from './CommentInput'
export type {CommentInputHandle} from './CommentInput'
export {SharedCommentsPanel} from './SharedCommentsPanel'
export {useSDKEditHandler} from './useSDKEditHandler'
export type {SDKEditHandlerResult} from './useSDKEditHandler'
export {AddonDataProvider, useAddonData, useOptionalAddonData} from './AddonDataContext'
export {
  buildCommentDocument,
  buildCommentThreads,
  buildMessageFromPlainText,
  buildStudioUrl,
  COMMENTS_BY_DOC_QUERY,
  groupUnresolvedCommentsByField,
  toPlainText,
} from './addonCommentUtils'
export {
  findUserByResourceUserId,
  getCurrentResourceUserId,
  getResourceUserId,
  getUserDisplayNameByResourceUserId,
} from './addonUserUtils'
export {useAddonComments} from './useAddonComments'
export {useAddonCommentMutations} from './useAddonCommentMutations'
export {useAddonTasks} from './useAddonTasks'
export {useAddonTaskMutations} from './useAddonTaskMutations'
export {useCurrentResourceUserId} from './useCurrentResourceUserId'
export type {
  AddonDataContextValue,
  AddonMessage,
  AddonTarget,
  CommentDocument,
  CommentReaction,
  CommentStatus,
  CrossDatasetReference,
  TaskContext,
  TaskDocument,
  TaskEditPayload,
  TaskStatus,
} from './addonTypes'

// Dialog components
export {CreateReleaseDialog} from './CreateReleaseDialog'
export {
  DocumentStatusBatchProvider,
  useOptionalDocumentStatusBatchContext,
} from './DocumentStatusBatchContext'
export type {
  ActiveReleaseSnapshot,
  DocumentStatusBatchContextValue,
  DocumentStatusMap,
  DocumentStatusSnapshot,
} from './DocumentStatusBatchContext'
export {useDocumentStatusBatch, normalizeBaseDocumentId} from './useDocumentStatusBatch'

// Composable cell components — use in column.custom() for custom columns
export {DocumentStatusCell} from './DocumentStatusCell'
export {ReferenceCell} from './ReferenceCell'
export {ReferenceEditPopover} from './ReferenceEditPopover'
export {UserCell} from './UserCell'
export {OpenInStudioCell} from './OpenInStudioCell'
