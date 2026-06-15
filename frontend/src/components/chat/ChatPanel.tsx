import { useRef, useEffect, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { useAguiStream } from '@/hooks/useAguiStream'
import { Bot } from 'lucide-react'

export function ChatPanel() {
  const { messages, toolResults, isRunning, sendMessage } = useAguiStream()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [prefillText, setPrefillText] = useState<string | undefined>()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, toolResults])

  return (
    <div className="flex flex-col h-full border-l border-[hsl(var(--border))]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border))]">
        <Bot className="h-4 w-4 text-[hsl(var(--agent-purple))]" />
        <span className="text-sm font-semibold">Agent Chat</span>
        {isRunning && (
          <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))] animate-pulse">thinking…</span>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[hsl(var(--muted-foreground))] text-sm text-center py-12">
            Ask me to create events, check availability, or register users.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map(msg => (
              <ChatMessage
                key={msg.id}
                message={msg}
                toolResults={toolResults}
                onPrefill={setPrefillText}
              />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        disabled={isRunning}
        prefillText={prefillText}
        onPrefillConsumed={() => setPrefillText(undefined)}
      />
    </div>
  )
}
