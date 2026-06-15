import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { Subject } from 'rxjs'
import { EventType } from '@ag-ui/core'
import { useAguiStream } from '@/hooks/useAguiStream'

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(QueryClientProvider, { client: new QueryClient() }, children)
}

// Capture the run mock outside so beforeEach can reset its return value
const mockRun = vi.fn()

vi.mock('@ag-ui/client', () => ({
  // Regular function (not arrow) so `new HttpAgent()` works correctly
  HttpAgent: vi.fn().mockImplementation(function (this: { run: typeof mockRun }) {
    this.run = mockRun
  }),
}))

function makeEvent(type: string, extra: Record<string, unknown> = {}) {
  return { type, ...extra }
}

describe('useAguiStream', () => {
  let subject: Subject<any>

  beforeEach(() => {
    subject = new Subject()
    mockRun.mockReturnValue(subject.asObservable())
  })

  it('starts with empty state', () => {
    const { result } = renderHook(() => useAguiStream(), { wrapper })
    expect(result.current.messages).toEqual([])
    expect(result.current.toolResults).toEqual([])
    expect(result.current.isRunning).toBe(false)
  })

  it('adds user message on sendMessage', () => {
    const { result } = renderHook(() => useAguiStream(), { wrapper })
    act(() => result.current.sendMessage('hello'))
    expect(result.current.messages[0].role).toBe('user')
    expect(result.current.messages[0].content).toBe('hello')
  })

  it('sets isRunning to true after sendMessage', () => {
    const { result } = renderHook(() => useAguiStream(), { wrapper })
    act(() => result.current.sendMessage('hello'))
    expect(result.current.isRunning).toBe(true)
  })

  it('accumulates assistant text from TEXT_MESSAGE events', () => {
    const { result } = renderHook(() => useAguiStream(), { wrapper })
    act(() => result.current.sendMessage('hello'))

    const msgId = 'msg-1'
    act(() => {
      subject.next(makeEvent(EventType.TEXT_MESSAGE_START, { messageId: msgId, role: 'assistant' }))
      subject.next(makeEvent(EventType.TEXT_MESSAGE_CONTENT, { messageId: msgId, delta: 'Hi ' }))
      subject.next(makeEvent(EventType.TEXT_MESSAGE_CONTENT, { messageId: msgId, delta: 'there!' }))
      subject.next(makeEvent(EventType.TEXT_MESSAGE_END, { messageId: msgId }))
    })

    const assistantMsg = result.current.messages.find(m => m.role === 'assistant')
    expect(assistantMsg?.content).toBe('Hi there!')
  })

  it('sets isRunning to false on RUN_FINISHED', () => {
    const { result } = renderHook(() => useAguiStream(), { wrapper })
    act(() => result.current.sendMessage('hello'))
    act(() => subject.next(makeEvent(EventType.RUN_FINISHED)))
    expect(result.current.isRunning).toBe(false)
  })

  it('captures tool results from TOOL_CALL_RESULT events', () => {
    const { result } = renderHook(() => useAguiStream(), { wrapper })
    act(() => result.current.sendMessage('register'))

    act(() => {
      subject.next(makeEvent(EventType.TEXT_MESSAGE_START, { messageId: 'msg-2', role: 'assistant' }))
      subject.next(makeEvent(EventType.TOOL_CALL_RESULT, {
        messageId: 'msg-tool-1',
        toolCallId: 'tc1',
        toolCallName: 'register_user',
        role: 'tool',
        content: '{"name":"Test"}',
      }))
    })

    expect(result.current.toolResults).toHaveLength(1)
    expect(result.current.toolResults[0].toolCallName).toBe('register_user')
  })
})
