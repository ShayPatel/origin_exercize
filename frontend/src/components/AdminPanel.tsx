import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Calendar, Users, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { useEvents, useCreateEvent, useRegistrations, type Event } from '@/hooks/useEvents'

function EventRow({ event }: { event: Event }) {
  const [expanded, setExpanded] = useState(false)
  const { data: registrations } = useRegistrations(expanded ? event.id : null)

  const isFull = event.spots_remaining === 0
  const isPast = new Date(event.event_date) < new Date()

  return (
    <div className="border border-[hsl(var(--border))] rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[hsl(var(--secondary))]/50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{event.name}</span>
            {isPast && <Badge variant="outline" className="text-xs shrink-0">Past</Badge>}
            {isFull && !isPast && <Badge className="text-xs shrink-0 bg-red-900/40 text-red-300 border-red-700/40">Full</Badge>}
          </div>
          <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(event.event_date).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {event.spots_remaining}/{event.capacity} open
            </span>
          </div>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/20 px-4 py-3">
          {event.description && (
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">{event.description}</p>
          )}
          <div className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2 uppercase tracking-wider">
            Registrations
          </div>
          {registrations?.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">No registrations yet.</p>
          ) : (
            <ul className="space-y-1">
              {registrations?.map(r => (
                <li key={r.id} className="text-xs font-mono text-[hsl(var(--foreground))]/80">
                  {r.user_id} — {new Date(r.registered_at).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function CreateEventForm() {
  const { mutate, isPending } = useCreateEvent()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [capacity, setCapacity] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    mutate(
      {
        name,
        description: description || null,
        event_date: new Date(eventDate).toISOString(),
        capacity: parseInt(capacity, 10),
      },
      {
        onSuccess: () => {
          setName(''); setDescription(''); setEventDate(''); setCapacity('')
        },
        onError: (err: Error) => setError(err.message),
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        placeholder="Event name"
        value={name}
        onChange={e => setName(e.target.value)}
        required
        className="bg-[hsl(var(--secondary))] border-[hsl(var(--border))]"
      />
      <Input
        placeholder="Description (optional)"
        value={description}
        onChange={e => setDescription(e.target.value)}
        className="bg-[hsl(var(--secondary))] border-[hsl(var(--border))]"
      />
      <Input
        type="datetime-local"
        value={eventDate}
        onChange={e => setEventDate(e.target.value)}
        required
        className="bg-[hsl(var(--secondary))] border-[hsl(var(--border))]"
      />
      <Input
        type="number"
        placeholder="Capacity"
        value={capacity}
        onChange={e => setCapacity(e.target.value)}
        min={1}
        required
        className="bg-[hsl(var(--secondary))] border-[hsl(var(--border))]"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90"
      >
        <Plus className="h-4 w-4 mr-1" />
        {isPending ? 'Creating…' : 'Create Event'}
      </Button>
    </form>
  )
}

export function AdminPanel() {
  const { data: events, isLoading, error } = useEvents()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[hsl(var(--border))]">
        <h1 className="text-lg font-bold tracking-tight">Event Manager</h1>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Admin control panel</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Event list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          <h2 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">
            Events ({events?.length ?? 0})
          </h2>
          {isLoading && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
          )}
          {error && (
            <p className="text-sm text-red-400">Failed to load events.</p>
          )}
          {events?.map(event => (
            <EventRow key={event.id} event={event} />
          ))}
          {events?.length === 0 && !isLoading && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No events yet. Create one →</p>
          )}
        </div>

        <Separator orientation="vertical" />

        {/* Create event sidebar */}
        <div className="w-72 shrink-0 px-5 py-4 overflow-y-auto">
          <h2 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">
            New Event
          </h2>
          <CreateEventForm />
        </div>
      </div>
    </div>
  )
}
