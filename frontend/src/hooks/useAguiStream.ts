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
  // Tool results arrive before their associated TEXT_MESSAGE_START.
  // Park them here and flush with the correct messageId when text begins.
  const pendingToolResultsRef = useRef<Omit<ToolResult, 'messageId'>[]>([])

  const flushPendingToolResults = (msgId: string) => {
    if (pendingToolResultsRef.current.length === 0) return
    const resolved: ToolResult[] = pendingToolResultsRef.current.map(tr => ({
      ...tr,
      messageId: msgId,
    }))
    pendingToolResultsRef.current = []
    setToolResults(prev => [...prev, ...resolved])
  }

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
    pendingToolResultsRef.current = []

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
            setMessages(prev => [...prev, { id: msgId, role: 'assistant', content: '' }])
            // Flush tool results that arrived before this text response
            flushPendingToolResults(msgId)
            break
          }
          case EventType.TEXT_MESSAGE_CONTENT: {
            const { messageId, delta } = event as any
            setMessages(prev =>
              prev.map(m => m.id === messageId ? { ...m, content: m.content + delta } : m)
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
            // Park — messageId will be assigned when the next TEXT_MESSAGE_START fires
            pendingToolResultsRef.current = [
              ...pendingToolResultsRef.current,
              { toolCallId, toolCallName: name, result: content },
            ]
            break
          }
          case EventType.RUN_FINISHED: {
            // Edge case: agent ended without a final text response.
            // Create a placeholder message so widgets still render.
            if (pendingToolResultsRef.current.length > 0) {
              const msgId = crypto.randomUUID()
              setMessages(prev => [...prev, { id: msgId, role: 'assistant', content: '' }])
              flushPendingToolResults(msgId)
            }
            setIsRunning(false)
            qc.invalidateQueries({ queryKey: ['events'] })
            break
          }
          case EventType.RUN_ERROR:
            pendingToolResultsRef.current = []
            setIsRunning(false)
            break
        }
      },
      error() {
        pendingToolResultsRef.current = []
        setIsRunning(false)
      },
      complete() {
        setIsRunning(false)
      },
    })
  }, [isRunning, messages])

  return { messages, toolResults, isRunning, sendMessage }
}
