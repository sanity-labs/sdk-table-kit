import {CommentIcon} from '@sanity/icons'
import {
  Badge,
  Button,
  Card,
  Heading,
  Popover,
  useClickOutsideEvent,
  useGlobalKeyDown,
} from '@sanity/ui'
import {useCallback, useRef} from 'react'

import type {EditedFieldIndicatorTone} from '../../helpers/releases/perspectiveTones'
import {useAddonComments} from '../../hooks/useAddonComments'
import {ActionBar} from '../common/ActionBar'
import {CellDecoratorFrame} from '../table/CellDecoratorFrame'
import {SharedCommentsPanel} from './SharedCommentsPanel'

interface CommentableCellFrameProps {
  children: React.ReactNode
  cellPadding: {x: number; y: number}
  commentFieldLabel: string
  commentFieldPath: string
  commentsState: ReturnType<typeof useAddonComments>
  documentId: string
  documentTitle?: string
  documentType: string
  editedIndicatorTone?: EditedFieldIndicatorTone
  onHoverChange: (hovered: boolean) => void
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  showTrigger: boolean
  totalCount: number
  unresolvedCount: number
}

export function CommentableCellFrame({
  children,
  cellPadding,
  commentFieldLabel,
  commentFieldPath,
  commentsState,
  documentId,
  documentTitle,
  documentType,
  editedIndicatorTone,
  onHoverChange,
  open,
  setOpen,
  showTrigger,
  totalCount,
  unresolvedCount,
}: CommentableCellFrameProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closePopover = useCallback(() => {
    setOpen(false)
  }, [setOpen])

  useClickOutsideEvent(open ? closePopover : undefined, () => [
    popoverRef.current,
    triggerRef.current,
  ])
  useGlobalKeyDown((event) => {
    if (!open || event.key !== 'Escape') return
    event.preventDefault()
    closePopover()
  })

  return (
    <div
      data-testid="commentable-cell-root"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      style={{alignItems: 'stretch', alignSelf: 'stretch', display: 'flex', minWidth: 0, width: '100%'}}
    >
      <CellDecoratorFrame
        cellPadding={cellPadding}
        contentTestId="commentable-cell-content"
        indicatorTone={editedIndicatorTone}
        trailing={
          <Popover
            animate
            content={
              <Card
                padding={4}
                radius={3}
                ref={popoverRef}
                shadow={3}
                style={{
                  maxHeight: 520,
                  maxWidth: 'min(720px, calc(100vw - 32px))',
                  overflowX: 'hidden',
                  overflowY: 'auto',
                  width: 'min(480px, calc(100vw - 32px))',
                }}
              >
                <div style={{minWidth: 0, width: '100%'}}>
                  <Heading size={2} style={{marginBottom: 16}} weight="medium">
                    {commentFieldLabel} comments
                  </Heading>
                  <SharedCommentsPanel
                    commentsState={commentsState}
                    documentId={documentId}
                    documentTitle={documentTitle ?? ''}
                    documentType={documentType}
                    fieldPath={commentFieldPath}
                  />
                </div>
              </Card>
            }
            open={open}
            placement="bottom"
            portal
            radius={3}
            shadow={3}
          >
            <ActionBar placement={{right: 10, top: 10}} visible={showTrigger}>
              <div style={{position: 'relative'}}>
                <Button
                  fontSize={1}
                  icon={<CommentIcon />}
                  mode="bleed"
                  onClick={(event) => {
                    event.stopPropagation()
                    setOpen((current) => !current)
                  }}
                  padding={2}
                  ref={triggerRef}
                  style={{
                    cursor: 'pointer',
                  }}
                  title={`${commentFieldLabel} comments`}
                />
                {totalCount > 0 && (
                  <Badge
                    padding={1}
                    style={{
                      alignItems: 'center',
                      aspectRatio: 1,
                      border: '1px solid var(--card-border-color)',
                      display: 'flex',
                      height: 20,
                      justifyContent: 'center',
                      position: 'absolute',
                      right: -12,
                      top: -12,
                    }}
                    tone={unresolvedCount > 0 ? 'caution' : 'default'}
                  >
                    {unresolvedCount > 0 ? unresolvedCount : totalCount}
                  </Badge>
                )}
              </div>
            </ActionBar>
          </Popover>
        }
      >
        {children}
      </CellDecoratorFrame>
    </div>
  )
}
