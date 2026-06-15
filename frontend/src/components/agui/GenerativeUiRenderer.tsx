import React from 'react'
import { AguiTicketWidget } from './AguiTicketWidget'
import { AguiCapacityWidget } from './AguiCapacityWidget'

// Maps tool names to the widget components that render their results.
// Only tools listed here get a rich widget — all others stay as plain agent text.
const COMPONENT_REGISTRY: Record<string, React.ComponentType<{ data: any; onUnregister?: (text: string) => void }>> = {
  AguiTicketWidget: AguiTicketWidget,
  AguiCapacityWidget: AguiCapacityWidget,
}

// Map MCP tool names → registry keys
const TOOL_TO_WIDGET: Record<string, string> = {
  register_user: 'AguiTicketWidget',
  update_event_capacity: 'AguiCapacityWidget',
}

interface GenerativeUiRendererProps {
  toolCallName: string
  result: string
  onUnregister?: (prefillText: string) => void
}

export function GenerativeUiRenderer({ toolCallName, result, onUnregister }: GenerativeUiRendererProps) {
  const widgetKey = TOOL_TO_WIDGET[toolCallName]
  if (!widgetKey) return null

  const TargetWidget = COMPONENT_REGISTRY[widgetKey]
  if (!TargetWidget) return null

  let data: unknown
  try {
    data = JSON.parse(result)
  } catch {
    return (
      <div className="text-xs text-[hsl(var(--muted-foreground))] p-3 border border-dashed rounded bg-[hsl(var(--secondary))]/20">
        Widget parse error for: <span className="font-mono text-amber-500">{toolCallName}</span>
      </div>
    )
  }

  return <TargetWidget data={data} onUnregister={onUnregister} />
}
