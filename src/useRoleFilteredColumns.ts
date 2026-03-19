import {useMemo} from 'react'
import {useCurrentUser} from '@sanity/sdk-react'
import type {ColumnDef} from '@sanetti/sanity-table-kit'

/**
 * Extended column def with role-based visibility props.
 * These are SDK-specific — not part of the base ColumnDef type.
 */
interface RoleAwareColumn extends ColumnDef {
  /** Role names (slugs) that can see this column. If unset, visible to all. */
  visibleTo?: string[]
  /** Role names (slugs) that can edit this column. If unset, edit available to all. */
  editableBy?: string[]
}

/**
 * Filter columns based on the current user's Sanity roles.
 *
 * - `visibleTo`: column hidden entirely if user has NONE of the listed roles
 * - `editableBy`: edit config stripped if user has NONE of the listed roles
 * - If currentUser is null but role props are used, logs a warning and shows all columns
 *
 * @param columns - Column definitions, potentially with visibleTo/editableBy
 * @returns Filtered and modified column definitions
 */
export function useRoleFilteredColumns(columns: ColumnDef[]): ColumnDef[] {
  const currentUser = useCurrentUser()

  return useMemo(() => {
    const roleColumns = columns as RoleAwareColumn[]
    const hasRoleProps = roleColumns.some((c) => c.visibleTo || c.editableBy)

    // If no columns use role props, skip all processing
    if (!hasRoleProps) return columns

    // If currentUser is null but role props are used, warn and show all
    if (!currentUser) {
      console.warn(
        '[table-kit] Columns use visibleTo/editableBy but no current user is available. ' +
          'All columns will be shown. Ensure your app is running within a Sanity context.',
      )
      return columns
    }

    const userRoleNames = new Set(currentUser.roles?.map((r: {name: string}) => r.name) ?? [])

    return roleColumns
      .filter((col) => {
        // If visibleTo is set, check if user has at least one matching role
        if (col.visibleTo && col.visibleTo.length > 0) {
          return col.visibleTo.some((role) => userRoleNames.has(role))
        }
        return true
      })
      .map((col) => {
        // If editableBy is set and user lacks the role, strip edit config
        if (col.editableBy && col.editableBy.length > 0) {
          const canEdit = col.editableBy.some((role) => userRoleNames.has(role))
          if (!canEdit) {
            const {edit, editableBy, visibleTo, ...rest} = col
            return rest as ColumnDef
          }
        }
        // Clean up SDK-specific props before passing to base DocumentTable
        const {editableBy, visibleTo, ...rest} = col
        return rest as ColumnDef
      })
  }, [columns, currentUser])
}
