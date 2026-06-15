import { cn } from '@/lib/utils'
import type { ChatMessage as ChatMessageType, ToolResult } from '@/hooks/useAguiStream'
import { GenerativeUiRenderer } from '@/components/agui/GenerativeUiRenderer'

interface ChatMessageProps {
  message: ChatMessageType
  toolResults: ToolResult[]
  onPrefill?: (text: string) => void
}

export function ChatMessage({ message, toolResults, onPrefill }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const relatedTools = toolResults.filter(t => t.messageId === message.id)

  return (
    <div className={cn('flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
            : 'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))]'
        )}
      >
        {message.content || (isUser ? '' : <span className="opacity-50 animate-pulse">…</span>)}
      </div>
      {relatedTools.map(tool => (
        <GenerativeUiRenderer
          key={tool.toolCallId}
          toolCallName={tool.toolCallName}
          result={tool.result}
          onUnregister={onPrefill}
        />
      ))}
    </div>
  )
}
