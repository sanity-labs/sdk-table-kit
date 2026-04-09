import type {TaskDocument} from '../../types/addonTypes'
import {buildTaskStudioUrl} from '../comments/addonCommentUtils'

export function compareOpenTasks(left: TaskDocument, right: TaskDocument) {
  const leftDue = left.dueBy ? new Date(left.dueBy).getTime() : Number.POSITIVE_INFINITY
  const rightDue = right.dueBy ? new Date(right.dueBy).getTime() : Number.POSITIVE_INFINITY

  if (leftDue !== rightDue) return leftDue - rightDue
  return new Date(right._createdAt).getTime() - new Date(left._createdAt).getTime()
}

export function formatRelativeTime(isoDate: string) {
  const diffMs = new Date(isoDate).getTime() - Date.now()
  const absDiffMs = Math.abs(diffMs)
  const formatter = new Intl.RelativeTimeFormat(undefined, {numeric: 'auto'})

  const ranges: Array<{unit: Intl.RelativeTimeFormatUnit; value: number}> = [
    {unit: 'minute', value: Math.round(diffMs / (1000 * 60))},
    {unit: 'hour', value: Math.round(diffMs / (1000 * 60 * 60))},
    {unit: 'day', value: Math.round(diffMs / (1000 * 60 * 60 * 24))},
    {unit: 'week', value: Math.round(diffMs / (1000 * 60 * 60 * 24 * 7))},
  ]

  if (absDiffMs < 1000 * 60 * 60) return formatter.format(ranges[0].value, ranges[0].unit)
  if (absDiffMs < 1000 * 60 * 60 * 24) return formatter.format(ranges[1].value, ranges[1].unit)
  if (absDiffMs < 1000 * 60 * 60 * 24 * 7) return formatter.format(ranges[2].value, ranges[2].unit)
  return formatter.format(ranges[3].value, ranges[3].unit)
}

export function getDateInputValue(dueBy?: string) {
  if (!dueBy) return ''
  return new Date(dueBy).toISOString().slice(0, 10)
}

export function formatCompactDisplayName(name?: string): null | string {
  if (!name) return null

  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0] ?? null

  const firstName = parts[0]
  const lastName = parts[parts.length - 1]
  if (!firstName || !lastName) return parts.join(' ')

  const surnameInitial = lastName.charAt(0).toUpperCase()
  return `${firstName} ${surnameInitial}`
}

export function getInitials(displayName: string) {
  return displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export function getStudioTaskUrl(task: TaskDocument, workspaceId?: string) {
  if (task.context?.notification?.url) return task.context.notification.url

  const fallback = buildTaskStudioUrl(task._id, workspaceId)
  if (typeof window === 'undefined') return fallback

  return new URL(fallback, window.location.origin).toString()
}

export function getTaskDueDateLabel(task: Pick<TaskDocument, 'dueBy' | 'status'>) {
  if (task.status === 'closed' || !task.dueBy) return undefined
  return new Date(task.dueBy).toLocaleDateString()
}

export function getTaskSummary({
  closedCount,
  openCount,
  overdueCount,
  taskCount,
  unassignedCount,
}: {
  closedCount: number
  openCount: number
  overdueCount: number
  taskCount: number
  unassignedCount: number
}) {
  if (taskCount === 0) return 'Add task'
  if (overdueCount > 0) return `${overdueCount} overdue`
  if (unassignedCount > 0) return `${openCount} open / ${unassignedCount} unassigned`
  if (openCount > 0) return `${openCount} open`
  return `${closedCount} done`
}

export function getTaskSummaryTone({
  openCount,
  overdueCount,
  unassignedCount,
}: {
  closedCount: number
  openCount: number
  overdueCount: number
  unassignedCount: number
}) {
  if (overdueCount > 0) return 'critical'
  if (unassignedCount > 0 || openCount > 0) return 'caution'
  return 'default'
}

export function isTaskOverdue(task: Pick<TaskDocument, 'dueBy' | 'status'>) {
  if (task.status !== 'open' || !task.dueBy) return false
  return new Date(task.dueBy).getTime() < Date.now()
}

export function isDateValueOverdue(dateValue: string | undefined, status: TaskDocument['status']) {
  if (status !== 'open' || !dateValue) return false
  return new Date(`${dateValue}T23:59:59`).getTime() < Date.now()
}

export function formatDateValueForDisplay(dateValue: string | undefined) {
  if (!dateValue) return 'No date'
  return new Date(`${dateValue}T12:00:00`).toLocaleDateString()
}

export function sectionToggleButtonStyle(isInteractive: boolean): React.CSSProperties {
  return {
    alignItems: 'center',
    background: 'none',
    border: 0,
    color: 'inherit',
    cursor: isInteractive ? 'pointer' : 'default',
    display: 'flex',
    gap: 6,
    padding: 0,
    textAlign: 'left',
    width: '100%',
  }
}

export function toDueDateIsoString(dateValue: string) {
  return new Date(`${dateValue}T12:00:00`).toISOString()
}

export const assignPickerStyle: React.CSSProperties = {
  left: 0,
  marginTop: 6,
  maxHeight: 220,
  overflowY: 'auto',
  position: 'absolute',
  top: '100%',
  width: 240,
  zIndex: 2,
}

export const dateInputStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--card-border-color)',
  borderRadius: 6,
  color: 'inherit',
  font: 'inherit',
  outline: 'none',
  padding: '6px 8px',
  width: '100%',
}

export const dueDateEditorStyle: React.CSSProperties = {
  marginTop: 6,
  position: 'absolute',
  right: 0,
  top: '100%',
  width: 220,
  zIndex: 2,
}

export const fullWidthInputStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--card-border-color)',
  borderRadius: 6,
  color: 'inherit',
  font: 'inherit',
  outline: 'none',
  padding: '8px 10px',
  width: '100%',
}

export const inlineInputStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--card-border-color)',
  borderRadius: 6,
  color: 'inherit',
  flex: 1,
  font: 'inherit',
  minWidth: 0,
  outline: 'none',
  padding: '4px 6px',
}

export const searchInputStyle: React.CSSProperties = {
  background: 'transparent',
  border: 0,
  color: 'inherit',
  flex: 1,
  font: 'inherit',
  minWidth: 0,
  outline: 'none',
}

export const taskAssignOptionButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  background: 'none',
  border: 0,
  color: 'inherit',
  cursor: 'pointer',
  display: 'flex',
  gap: 8,
  padding: 0,
  textAlign: 'left',
  width: '100%',
}

export const taskRowButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 0,
  cursor: 'pointer',
  padding: 0,
  textAlign: 'left',
  width: '100%',
}
