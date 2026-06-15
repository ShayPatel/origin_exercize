import { useState, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { HttpAgent } from '@ag-ui/client'
import { EventType } from '@ag-ui/core'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface ToolResult {
  toolCallId: string
  toolCallName: string
  result: string
  messageId: string
}

interface UseAguiStreamReturn {
  messages: ChatMessage[]
  toolResults: ToolResult[]
  isRunning: boolean
  sendMessage: (text: string) => void
}

export function useAguiStream(): UseAguiStreamReturn {
  const qc = useQueryClient()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [toolResults, setToolResults] = useState<ToolResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const threadIdRef = useRef<string>(crypto.randomUUID())
  const currentAssistantIdRef = useRef<string | null>(null)
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)

  const sendMessage = useCallback((text: string) => {
    if (isRunning) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    }
    setMessages(prev => [...prev, userMsg])
    setIsRunning(true)
    currentAssistantIdRef.current = null

    const allMessages = [...messages, userMsg].map(m => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const agent = new HttpAgent({ url: '/api/v1/chat/stream' })
    const observable = agent.run({
      threadId: threadIdRef.current,
      runId: crypto.randomUUID(),
      messages: allMessages,
      tools: [],
    })

    const lastToolCallNameRef: Record<string, string> = {}

    subscriptionRef.current = observable.subscribe({
      next(event) {
        switch (event.type) {
          case EventType.TEXT_MESSAGE_START: {
            const msgId = (event as any).messageId ?? crypto.randomUUID()
            currentAssistantIdRef.current = msgId
            setMessages(prev => [
              ...prev,
              { id: msgId, role: 'assistant', content: '' },
            ])
            break
          }
          case EventType.TEXT_MESSAGE_CONTENT: {
            const { messageId, delta } = event as any
            setMessages(prev =>
              prev.map(m =>
                m.id === messageId ? { ...m, content: m.content + delta } : m
              )
            )
            break
          }
          case EventType.TOOL_CALL_START: {
            const { toolCallId, toolCallName } = event as any
            lastToolCallNameRef[toolCallId] = toolCallName
            break
          }
          case EventType.TOOL_CALL_RESULT: {
            const { toolCallId, toolCallName, content } = event as any
            const name = toolCallName ?? lastToolCallNameRef[toolCallId] ?? ''
            setToolResults(prev => [
              ...prev,
              {
                toolCallId,
                toolCallName: name,
                result: content,
                messageId: currentAssistantIdRef.current ?? '',
              },
            ])
            break
          }
          case EventType.RUN_FINISHED:
            setIsRunning(false)
            qc.invalidateQueries({ queryKey: ['events'] })
            break
          case EventType.RUN_ERROR:
            setIsRunning(false)
            break
        }
      },
      error() {
        setIsRunning(false)
      },
      complete() {
        setIsRunning(false)
      },
    })
  }, [isRunning, messages])

  return { messages, toolResults, isRunning, sendMessage }
}
