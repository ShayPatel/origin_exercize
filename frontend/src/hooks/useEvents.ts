import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface Event {
  id: string
  name: string
  description: string | null
  event_date: string
  capacity: number
  spots_remaining: number
}

export interface Registration {
  id: string
  event_id: string
  user_id: string
  registered_at: string
}

async function fetchEvents(): Promise<Event[]> {
  const res = await fetch('/api/events')
  if (!res.ok) throw new Error('Failed to fetch events')
  return res.json()
}

async function createEvent(data: Omit<Event, 'id' | 'spots_remaining'>): Promise<Event> {
  const res = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail ?? 'Failed to create event')
  }
  return res.json()
}

async function fetchRegistrations(eventId: string): Promise<Registration[]> {
  const res = await fetch(`/api/events/${eventId}/registrations`)
  if (!res.ok) throw new Error('Failed to fetch registrations')
  return res.json()
}

export function useEvents() {
  return useQuery({ queryKey: ['events'], queryFn: fetchEvents })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  })
}

export function useRegistrations(eventId: string | null) {
  return useQuery({
    queryKey: ['registrations', eventId],
    queryFn: () => fetchRegistrations(eventId!),
    enabled: !!eventId,
  })
}
