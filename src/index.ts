// @sanity-labs/sdk-table-kit — SDK-native integration layer
// Re-exports everything from @sanity-labs/react-table-kit + SDK additions

// Re-export base table-kit
export {
  DocumentTable,
  BadgeCell,
  TableCellChrome,
  filter,
  useFilterPresets,
  useFilterUrlState,
} from '@sanity-labs/react-table-kit'
export type {BadgeCellProps, BadgeColorMap, BadgeColorMapEntry} from '@sanity-labs/react-table-kit'
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
  TableCellChromeBorderMode,
  TableCellChromeProps,
  TableCellChromeState,
  UseFilterUrlStateResult,
} from '@sanity-labs/react-table-kit'

// Unified column namespace — base + SDK helpers in one object
export {column} from './helpers/table/column'
export type {PreviewConfig, PreviewValue} from '@sanity/types'

// SDK-specific exports
export {useColumnProjection} from './hooks/useColumnProjection'
export {parseFieldExpression} from './hooks/useColumnProjection'
export type {
  CellCommentsConfig,
  SanityColumnDef,
  ParsedFieldExpression,
} from './hooks/useColumnProjection'
export {resolveColumnAliases} from './helpers/table/resolveColumnAliases'
export {useSanityTableData} from './hooks/useSanityTableData'
export type {
  SanityTableDataConfig,
  SanityTableDataResult,
  PaginationState,
  SortingState,
} from './hooks/useSanityTableData'
export {useSanityDocumentTable} from './hooks/useSanityDocumentTable'
export type {SanityDocumentTableHookResult} from './hooks/useSanityDocumentTable'
export {SanityDocumentTable} from './components/table/SanityDocumentTable'
export type {SanityDocumentTableProps} from './components/table/SanityDocumentTable'
export {PaginationControls} from './components/table/PaginationControls'
export type {PaginationControlsProps} from './components/table/PaginationControls'
export {PreviewCell} from './components/table/PreviewCell'
export type {PreviewCellProps} from './components/table/PreviewCell'
export {CommentableCell} from './components/comments/CommentableCell'
export {ActionBar} from './components/common/ActionBar'
export type {ActionBarProps} from './components/common/ActionBar'
export {CommentInput} from './components/comments/CommentInput'
export type {CommentInputHandle} from './components/comments/CommentInput'
export {SharedCommentsPanel} from './components/comments/SharedCommentsPanel'
export {useSDKEditHandler} from './hooks/useSDKEditHandler'
export type {SDKEditHandlerResult} from './hooks/useSDKEditHandler'
export {AddonDataProvider, useAddonData, useOptionalAddonData} from './context/AddonDataContext'
export {
  buildCommentDocument,
  buildCommentThreads,
  buildMessageFromPlainText,
  buildStudioUrl,
  groupUnresolvedCommentsByField,
  toPlainText,
} from './helpers/comments/addonCommentUtils'
export {
  findUserByResourceUserId,
  getCurrentResourceUserId,
  getResourceUserId,
  getUserDisplayNameByResourceUserId,
} from './helpers/users/addonUserUtils'
export {useAddonComments} from './hooks/useAddonComments'
export {useAddonCommentMutations} from './hooks/useAddonCommentMutations'
export {useAddonTasks} from './hooks/useAddonTasks'
export {useAddonTaskMutations} from './hooks/useAddonTaskMutations'
export {useCurrentResourceUserId} from './hooks/useCurrentResourceUserId'
export {useTaskComments} from './hooks/useTaskComments'
export {useTaskCommentMutations} from './hooks/useTaskCommentMutations'
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
} from './types/addonTypes'

// Dialog components
export {CreateReleaseDialog} from './components/releases/CreateReleaseDialog'
export {
  DocumentStatusBatchProvider,
  useOptionalDocumentStatusBatchContext,
} from './context/DocumentStatusBatchContext'
export type {
  ActiveReleaseSnapshot,
  DocumentStatusBatchContextValue,
  DocumentStatusMap,
  DocumentStatusSnapshot,
} from './context/DocumentStatusBatchContext'
export {useDocumentStatusBatch, normalizeBaseDocumentId} from './hooks/useDocumentStatusBatch'

// Composable cell components — use in column.custom() for custom columns
export {DocumentStatusCell} from './components/status/DocumentStatusCell'
export {ReferenceCell} from './components/references/ReferenceCell'
export {ReferenceEditPopover} from './components/references/ReferenceEditPopover'
export {UserCell} from './components/users/UserCell'
export {OpenInStudioCell} from './components/table/OpenInStudioCell'
