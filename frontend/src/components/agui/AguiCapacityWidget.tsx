import { Settings2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface CapacityData {
  name: string
  old_capacity: number
  new_capacity: number
  current_registrations: number
}

interface AguiCapacityWidgetProps {
  data: CapacityData
}

export function AguiCapacityWidget({ data }: AguiCapacityWidgetProps) {
  const percentage = data.new_capacity > 0
    ? (data.current_registrations / data.new_capacity) * 100
    : 0

  return (
    <Card className="border border-[hsl(var(--agent-purple))]/40 bg-purple-950/10 max-w-sm animate-in fade-in zoom-in-95 duration-200">
      <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-[hsl(var(--agent-purple))]">
          System Scale Adjusted
        </CardTitle>
        <Settings2 className="h-3.5 w-3.5 text-[hsl(var(--agent-purple))]" />
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        <div className="text-sm font-semibold">{data.name}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs line-through text-[hsl(var(--muted-foreground))]">{data.old_capacity}</span>
          <span className="text-lg font-bold text-[hsl(var(--foreground))]">→ {data.new_capacity} Max Seats</span>
        </div>
        <Progress value={percentage} className="h-1.5 bg-[hsl(var(--secondary))]" />
        <div className="flex justify-between text-[11px] text-[hsl(var(--muted-foreground))] font-mono">
          <span>{data.current_registrations} filled</span>
          <span>{data.new_capacity - data.current_registrations} open</span>
        </div>
      </CardContent>
    </Card>
  )
}
