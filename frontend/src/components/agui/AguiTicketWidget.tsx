import { Calendar, Ticket, XCircle } from 'lucide-react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface TicketData {
  name: string
  event_date: string
  registration_id?: string
  event_id?: string
  user_id?: string
}

interface AguiTicketWidgetProps {
  data: TicketData
  onUnregister?: (prefillText: string) => void
}

export function AguiTicketWidget({ data, onUnregister }: AguiTicketWidgetProps) {
  const handleUnregister = () => {
    const text = data.user_id && data.name
      ? `Unregister user ${data.user_id} from event "${data.name}"`
      : 'Unregister me from this event'
    onUnregister?.(text)
  }

  return (
    <Card className="border-l-4 border-l-[hsl(var(--primary))] bg-[hsl(var(--secondary))]/40 backdrop-blur-sm max-w-sm relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <Badge variant="outline" className="text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30 mb-1">
              Confirmed Entry
            </Badge>
            <h4 className="font-bold text-base tracking-tight">{data.name}</h4>
          </div>
          <Ticket className="h-5 w-5 text-[hsl(var(--muted-foreground))]/50" />
        </div>
        <div className="flex items-center text-xs text-[hsl(var(--muted-foreground))] gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          <span>{new Date(data.event_date).toLocaleDateString()}</span>
        </div>
      </CardContent>
      <div className="border-t-2 border-dashed border-[hsl(var(--border))] my-1 relative mx-4" />
      <CardFooter className="p-3 px-4 flex justify-between bg-black/20 items-center">
        <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] tracking-widest uppercase">
          ID: {data.registration_id?.slice(0, 8) ?? 'N/A'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[hsl(var(--destructive-foreground))] hover:bg-[hsl(var(--destructive))]/10 gap-1 text-xs text-red-400 hover:text-red-300"
          onClick={handleUnregister}
        >
          <XCircle className="h-3 w-3" />
          Unregister
        </Button>
      </CardFooter>
    </Card>
  )
}
