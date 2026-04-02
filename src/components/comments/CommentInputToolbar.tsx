import {Box, Button, Flex} from '@sanity/ui'
import {Send} from 'lucide-react'

export function CommentInputToolbar({
  hasContent,
  onAddMention,
  onSend,
}: {
  hasContent: boolean
  onAddMention: () => void
  onSend: () => void
}) {
  return (
    <Flex align="center" gap={1} style={{bottom: 6, position: 'absolute', right: 8}}>
      <Button
        fontSize={1}
        mode="bleed"
        onClick={onAddMention}
        padding={2}
        text="@"
        title="Mention someone"
      />
      <Box
        style={{
          background: 'var(--card-border-color)',
          height: 16,
          width: 1,
        }}
      />
      <Button
        disabled={!hasContent}
        fontSize={1}
        icon={<Send size={16} />}
        mode="bleed"
        onClick={onSend}
        padding={2}
        title="Send (⌘+Enter)"
      />
    </Flex>
  )
}
