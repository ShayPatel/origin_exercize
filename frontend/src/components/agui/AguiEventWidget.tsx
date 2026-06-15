import { CalendarPlus, Users, UserPlus } from 'lucide-react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface EventData {
  id?: string
  name: string
  description?: string
  event_date: string
  capacity: number
  spots_remaining: number
}

interface AguiEventWidgetProps {
  data: EventData
  onUnregister?: (prefillText: string) => void
}

export function AguiEventWidget({ data, onUnregister }: AguiEventWidgetProps) {
  const handleRegister = () => {
    onUnregister?.(`Register someone for event "${data.name}"`)
  }

  return (
    <Card className="border-l-4 border-l-emerald-500 bg-[hsl(var(--secondary))]/40 backdrop-blur-sm max-w-sm relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 mb-1">
              Event Created
            </Badge>
            <h4 className="font-bold text-base tracking-tight">{data.name}</h4>
          </div>
          <CalendarPlus className="h-5 w-5 text-emerald-500/60" />
        </div>

        <div className="flex items-center text-xs text-[hsl(var(--muted-foreground))] gap-1.5">
          <CalendarPlus className="h-3.5 w-3.5" />
          <span>{new Date(data.event_date).toLocaleString()}</span>
        </div>

        <div className="flex items-center text-xs text-[hsl(var(--muted-foreground))] gap-1.5">
          <Users className="h-3.5 w-3.5" />
          <span>{data.spots_remaining} / {data.capacity} spots available</span>
        </div>
      </CardContent>

      <div className="border-t-2 border-dashed border-[hsl(var(--border))] my-1 relative mx-4" />

      <CardFooter className="p-3 px-4 flex justify-between bg-black/20 items-center">
        <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] tracking-widest uppercase">
          ID: {data.id?.slice(0, 8) ?? 'N/A'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1 text-xs"
          onClick={handleRegister}
        >
          <UserPlus className="h-3 w-3" />
          Register Someone
        </Button>
      </CardFooter>
    </Card>
  )
}
