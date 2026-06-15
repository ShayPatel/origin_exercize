import React from 'react'
import { AguiTicketWidget } from './AguiTicketWidget'
import { AguiCapacityWidget } from './AguiCapacityWidget'
import { AguiEventWidget } from './AguiEventWidget'

// Maps tool names to the widget components that render their results.
// Only tools listed here get a rich widget — all others stay as plain agent text.
const COMPONENT_REGISTRY: Record<string, React.ComponentType<{ data: any; onUnregister?: (text: string) => void }>> = {
  AguiTicketWidget: AguiTicketWidget,
  AguiCapacityWidget: AguiCapacityWidget,
  AguiEventWidget: AguiEventWidget,
}

// Map MCP tool names → registry keys
const TOOL_TO_WIDGET: Record<string, string> = {
  register_user: 'AguiTicketWidget',
  update_event_capacity: 'AguiCapacityWidget',
  create_event: 'AguiEventWidget',
}

interface GenerativeUiRendererProps {
  toolCallName: string
  result: string
  onUnregister?: (prefillText: string) => void
}

// ADK serialises the FastMCP CallToolResult wrapper as the TOOL_CALL_RESULT
// content. The actual tool return value lives at structuredContent.result, or
// can be recovered by JSON-parsing content[0].text.
function extractToolData(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    const sc = obj.structuredContent as Record<string, unknown> | undefined
    if (sc?.result !== undefined) return sc.result
    const items = obj.content as Array<Record<string, unknown>> | undefined
    if (Array.isArray(items) && items.length > 0) {
      const first = items[0]
      if (first?.type === 'text' && typeof first?.text === 'string') {
        try { return JSON.parse(first.text as string) } catch { /* fall through */ }
      }
    }
  }
  return raw
}

export function GenerativeUiRenderer({ toolCallName, result, onUnregister }: GenerativeUiRendererProps) {
  const widgetKey = TOOL_TO_WIDGET[toolCallName]
  if (!widgetKey) return null

  const TargetWidget = COMPONENT_REGISTRY[widgetKey]
  if (!TargetWidget) return null

  let data: unknown
  try {
    data = extractToolData(JSON.parse(result))
  } catch {
    return (
      <div className="text-xs text-[hsl(var(--muted-foreground))] p-3 border border-dashed rounded bg-[hsl(var(--secondary))]/20">
        Widget parse error for: <span className="font-mono text-amber-500">{toolCallName}</span>
      </div>
    )
  }

  return <TargetWidget data={data} onUnregister={onUnregister} />
}
