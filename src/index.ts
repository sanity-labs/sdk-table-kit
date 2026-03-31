// @sanetti/sanity-sdk-table-kit — SDK-native integration layer
// Re-exports everything from @sanetti/sanity-table-kit + SDK additions

// Re-export base table-kit
export {DocumentTable, BadgeCell} from '@sanetti/sanity-table-kit'
export type {BadgeCellProps, BadgeColorMap, BadgeColorMapEntry} from '@sanetti/sanity-table-kit'
export type {
  ColumnDef,
  SortConfig,
  DocumentBase,
  SelectionConfig,
  DocumentTableProps,
} from '@sanetti/sanity-table-kit'

// Unified column namespace — base + SDK helpers in one object
export {column} from './column'
export type {PreviewConfig, PreviewValue} from '@sanity/types'

// SDK-specific exports
export {useColumnProjection} from './useColumnProjection'
export {parseFieldExpression} from './useColumnProjection'
export type {SanityColumnDef, ParsedFieldExpression} from './useColumnProjection'
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
export {useSDKEditHandler} from './useSDKEditHandler'
export type {SDKEditHandlerResult} from './useSDKEditHandler'

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
